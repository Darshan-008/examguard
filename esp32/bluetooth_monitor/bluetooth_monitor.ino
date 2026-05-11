/*
 * =====================================================
 * Bluetooth Detection Monitoring System — ESP32 Firmware
 * =====================================================
 * Board  : ESP32 DevKit V1
 * Purpose: Scan Bluetooth devices continuously and send
 *          detection logs to the backend REST API.
 *          Receive jammer ON/OFF commands via heartbeat.
 *
 * Libraries required (install via Arduino Library Manager):
 *   - ArduinoJson  (by Benoit Blanchon)
 *   - HTTPClient   (built-in ESP32)
 *   - BluetoothSerial (built-in ESP32)
 *
 * Board Manager: esp32 by Espressif Systems
 * =====================================================
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "esp_bt.h"
#include "esp_gap_bt_api.h"
#include "esp_bt_main.h"
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>

// ─── CONFIGURATION ────────────────────────────────────────────────────────────
const char* WIFI_SSID       = "Iqoo";
const char* WIFI_PASSWORD   = "123456789";
const char* BACKEND_URL     = "https://examguard-backend-c4oe.onrender.com"; // Render URL
const char* DEVICE_ID       = "ESP32-A101";                 // Must match DB deviceId
const char* CLASSROOM_ID    = "";                           // MongoDB Classroom _id (optional)

const int   SCAN_INTERVAL_MS    = 15000;  // 15 seconds between scans
const int   HEARTBEAT_INTERVAL  = 30000;  // Heartbeat every 30 seconds
const int   RSSI_THRESHOLD      = -100;   // Capture all signals
const int   JAMMER_PIN          = 2;      // GPIO pin for jammer relay control

// ─── GLOBALS ──────────────────────────────────────────────────────────────────
bool jammerActive   = false;
bool monitoringActive = true;
bool wifiConnected  = false;
unsigned long lastHeartbeat  = 0;
unsigned long lastScan       = 0;

// ─── WiFi CONNECTION ──────────────────────────────────────────────────────────
void connectWiFi() {
  Serial.printf("[WiFi] Connecting to %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 30) {
    delay(500); Serial.print("."); retries++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.printf("\n[WiFi] Connected! IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n[WiFi] Connection failed. Will retry...");
    wifiConnected = false;
  }
}

// ─── SEND DETECTION TO BACKEND ────────────────────────────────────────────────
void sendDetection(const char* macAddress, int rssi, const char* deviceName, uint32_t cod = 0, uint16_t appearance = 0) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(BACKEND_URL) + "/api/detection";
  http.begin(url);
  http.setInsecure(); // Required for HTTPS
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<512> doc;
  doc["deviceId"]    = DEVICE_ID;
  doc["macAddress"]  = macAddress;
  doc["rssi"]        = rssi;
  doc["deviceName"]  = deviceName;
  if (cod != 0) doc["deviceClass"] = cod;
  if (appearance != 0) doc["appearance"] = appearance;
  if (strlen(CLASSROOM_ID) > 0) doc["classroomId"] = CLASSROOM_ID;

  String body;
  serializeJson(doc, body);

  int code = http.POST(body);
  if (code == 201) {
    Serial.printf("[API] Detection sent: %s (RSSI: %d)\n", macAddress, rssi);
  } else {
    Serial.printf("[API] Send failed: HTTP %d\n", code);
  }
  http.end();
}

// ─── HEARTBEAT ────────────────────────────────────────────────────────────────
void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(BACKEND_URL) + "/api/devices/heartbeat";
  http.begin(url);
  http.setInsecure(); // Required for HTTPS
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<128> doc;
  doc["deviceId"]  = DEVICE_ID;
  doc["ipAddress"] = WiFi.localIP().toString();

  String body;
  serializeJson(doc, body);

  int code = http.POST(body);
  if (code == 200) {
    // Parse jammer command from response
    String res = http.getString();
    StaticJsonDocument<128> resp;
    deserializeJson(resp, res);
    bool shouldJam = (String(resp["jammerStatus"].as<const char*>()) == "active");
    if (shouldJam != jammerActive) {
      jammerActive = shouldJam;
      digitalWrite(JAMMER_PIN, jammerActive ? HIGH : LOW);
    }
    
    bool shouldMonitor = (String(resp["monitoringStatus"].as<const char*>()) == "active");
    if (shouldMonitor != monitoringActive) {
      monitoringActive = shouldMonitor;
      Serial.printf("[System] Monitoring: %s\n", monitoringActive ? "ENABLED" : "DISABLED");
    }

    Serial.printf("[Jammer] %s\n", jammerActive ? "ON" : "OFF");
  }
  http.end();
}

// ─── CLASSIC BLUETOOTH SCAN ───────────────────────────────────────────────────
// Callback for discovered devices
static esp_bt_gap_cb_param_t::disc_res_param* discoveredDevices[20];
static int discoveredCount = 0;

void btGapCallback(esp_bt_gap_cb_event_t event, esp_bt_gap_cb_param_t* param) {
  if (!monitoringActive) return; // Ignore if monitoring is OFF

  if (event == ESP_BT_GAP_DISC_RES_EVT) {
    char mac[18];
    snprintf(mac, sizeof(mac), "%02X:%02X:%02X:%02X:%02X:%02X",
      param->disc_res.bda[0], param->disc_res.bda[1], param->disc_res.bda[2],
      param->disc_res.bda[3], param->disc_res.bda[4], param->disc_res.bda[5]);

    int rssi = -100;
    char nameBuf[64] = "Unknown Device";
    uint32_t cod = 0;

    for (int i = 0; i < param->disc_res.num_prop; i++) {
      if (param->disc_res.prop[i].type == ESP_BT_GAP_DEV_PROP_RSSI) rssi = *(int8_t*)param->disc_res.prop[i].val;
      if (param->disc_res.prop[i].type == ESP_BT_GAP_DEV_PROP_BDNAME) strncpy(nameBuf, (char*)param->disc_res.prop[i].val, sizeof(nameBuf) - 1);
      if (param->disc_res.prop[i].type == ESP_BT_GAP_DEV_PROP_COD) cod = *(uint32_t*)param->disc_res.prop[i].val;
    }

    if (rssi >= RSSI_THRESHOLD) {
      Serial.printf("[BT] Found: %s | RSSI: %d | CoD: 0x%06X\n", mac, rssi, cod);
      sendDetection(mac, rssi, nameBuf, cod, 0);
    }
  }
  else if (event == ESP_BT_GAP_DISC_STATE_CHANGED_EVT) {
    if (param->disc_st_chg.state == ESP_BT_GAP_DISCOVERY_STOPPED) {
      Serial.println("[BT] Scan complete.");
    }
  }
}

// BLE Callback
class MyAdvertisedDeviceCallbacks: public BLEAdvertisedDeviceCallbacks {
    void onResult(BLEAdvertisedDevice advertisedDevice) {
        if (!monitoringActive) return; // Ignore if monitoring is OFF
        
        if (advertisedDevice.getRSSI() >= RSSI_THRESHOLD) {
            String mac = advertisedDevice.getAddress().toString().c_str();
            int rssi = advertisedDevice.getRSSI();
            String name = advertisedDevice.getName().c_str();
            uint16_t appearance = advertisedDevice.getAppearance();
            if (name == "") name = "BLE Device";
            
            Serial.printf("[BLE] Found: %s | RSSI: %d | App: %d\n", mac.c_str(), rssi, appearance);
            sendDetection(mac.c_str(), rssi, name.c_str(), 0, appearance);
        }
    }
};

void startBluetoothScan() {
  // 1. BLE Scan
  Serial.println("[BLE] Starting scan...");
  BLEScan* pBLEScan = BLEDevice::getScan();
  pBLEScan->setAdvertisedDeviceCallbacks(new MyAdvertisedDeviceCallbacks());
  pBLEScan->setActiveScan(true);
  pBLEScan->start(5, false); // Scan for 5 seconds

  // 2. Classic BT Scan
  Serial.println("[BT] Initiating discovery...");
  esp_err_t err = esp_bt_gap_start_discovery(ESP_BT_INQ_MODE_GENERAL_INQUIRY, 5, 0); // 5 * 1.28s
  if (err != ESP_OK) {
    Serial.printf("[BT] Discovery start failed: %s\n", esp_err_to_name(err));
  }
}

// ─── SETUP ────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  Serial.println("\n[System] Bluetooth Detection Monitor Starting...");

  // Jammer relay pin
  pinMode(JAMMER_PIN, OUTPUT);
  digitalWrite(JAMMER_PIN, LOW);

  // WiFi
  connectWiFi();

  // Initialize Bluetooth controller
  esp_bt_controller_config_t bt_cfg = BT_CONTROLLER_INIT_CONFIG_DEFAULT();
  if (esp_bt_controller_init(&bt_cfg) != ESP_OK) {
    Serial.println("[BT] Controller init failed!"); return;
  }
  if (esp_bt_controller_enable(ESP_BT_MODE_CLASSIC_BT) != ESP_OK) {
    Serial.println("[BT] Controller enable failed!"); return;
  }
  if (esp_bluedroid_init() != ESP_OK) {
    Serial.println("[BT] Bluedroid init failed!"); return;
  }
  if (esp_bluedroid_enable() != ESP_OK) {
    Serial.println("[BT] Bluedroid enable failed!"); return;
  }

  esp_bt_gap_register_callback(btGapCallback);
  esp_bt_gap_set_scan_mode(ESP_BT_CONNECTABLE, ESP_BT_GENERAL_DISCOVERABLE);

  // Init BLE
  BLEDevice::init(DEVICE_ID);

  Serial.println("[System] Monitoring Started...");
  sendHeartbeat();
}

// ─── LOOP ─────────────────────────────────────────────────────────────────────
void loop() {
  unsigned long now = millis();

  // Reconnect WiFi if dropped
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Reconnecting...");
    connectWiFi();
    delay(2000);
    return;
  }

  // Periodic Bluetooth scan
  if (monitoringActive && (now - lastScan >= SCAN_INTERVAL_MS)) {
    lastScan = now;
    startBluetoothScan();
  }

  // Periodic heartbeat
  if (now - lastHeartbeat >= HEARTBEAT_INTERVAL) {
    lastHeartbeat = now;
    sendHeartbeat();
  }

  delay(100);
}
