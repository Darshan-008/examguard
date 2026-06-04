/*
 * =====================================================
 * Bluetooth Detection Monitoring System — ESP32 Firmware
 * =====================================================
 * Updates: 
 * - Normalized MAC addresses to UPPERCASE
 * - Optimized BLE Scan Window for Name Discovery
 * - Extended Classic BT Inquiry Duration
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
const char* BACKEND_URL     = "http://10.117.180.134:5000";  // Your Backend IP
const char* DEVICE_ID       = "ESP32-A101";                 // Must match DB

const int   SCAN_INTERVAL_MS    = 15000;  // 15 seconds between scans
const int   HEARTBEAT_INTERVAL  = 30000;  // Heartbeat every 30 seconds
const int   RSSI_THRESHOLD      = -100;   // Capture all signals
const int   JAMMER_PIN          = 2;      // GPIO pin for jammer relay control

// ─── GLOBALS ──────────────────────────────────────────────────────────────────
bool jammerActive   = false;
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
    Serial.printf("\n[WiFi] Connected! IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n[WiFi] Connection failed. Retrying...");
  }
}

// ─── SEND DETECTION TO BACKEND ────────────────────────────────────────────────
void sendDetection(const char* macAddress, int rssi, const char* deviceName) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(BACKEND_URL) + "/api/detection";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<256> doc;
  doc["deviceId"]    = DEVICE_ID;
  doc["macAddress"]  = macAddress; // Backend will receive Uppercase
  doc["rssi"]        = rssi;
  doc["deviceName"]  = deviceName;

  String body;
  serializeJson(doc, body);

  int code = http.POST(body);
  if (code == 201 || code == 200) {
    Serial.printf("[API] Sent: %s (%s)\n", macAddress, deviceName);
  } else {
    Serial.printf("[API] Failed: HTTP %d\n", code);
  }
  http.end();
}

// ─── HEARTBEAT ────────────────────────────────────────────────────────────────
void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(BACKEND_URL) + "/api/devices/heartbeat";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<128> doc;
  doc["deviceId"]  = DEVICE_ID;
  doc["ipAddress"] = WiFi.localIP().toString();

  String body;
  serializeJson(doc, body);

  int code = http.POST(body);
  if (code == 200) {
    String res = http.getString();
    StaticJsonDocument<128> resp;
    deserializeJson(resp, res);
    bool shouldJam = (String(resp["jammerStatus"].as<const char*>()) == "active");
    if (shouldJam != jammerActive) {
      jammerActive = shouldJam;
      digitalWrite(JAMMER_PIN, jammerActive ? HIGH : LOW);
    }
  }
  http.end();
}

// ─── CLASSIC BLUETOOTH CALLBACK ──────────────────────────────────────────────
void btGapCallback(esp_bt_gap_cb_event_t event, esp_bt_gap_cb_param_t* param) {
  if (event == ESP_BT_GAP_DISC_RES_EVT) {
    char mac[18];
    snprintf(mac, sizeof(mac), "%02X:%02X:%02X:%02X:%02X:%02X",
      param->disc_res.bda[0], param->disc_res.bda[1], param->disc_res.bda[2],
      param->disc_res.bda[3], param->disc_res.bda[4], param->disc_res.bda[5]);

    int rssi = -100;
    char nameBuf[64] = "";

    for (int i = 0; i < param->disc_res.num_prop; i++) {
      if (param->disc_res.prop[i].type == ESP_BT_GAP_DEV_PROP_RSSI) rssi = *(int8_t*)param->disc_res.prop[i].val;
      if (param->disc_res.prop[i].type == ESP_BT_GAP_DEV_PROP_BDNAME) strncpy(nameBuf, (char*)param->disc_res.prop[i].val, sizeof(nameBuf) - 1);
    }

    if (rssi >= RSSI_THRESHOLD) {
      String finalName = (strlen(nameBuf) > 0) ? String(nameBuf) : "Unknown Device";
      sendDetection(mac, rssi, finalName.c_str());
    }
  }
}

// ─── BLE CALLBACK ─────────────────────────────────────────────────────────────
class MyAdvertisedDeviceCallbacks: public BLEAdvertisedDeviceCallbacks {
    void onResult(BLEAdvertisedDevice advertisedDevice) {
        if (advertisedDevice.getRSSI() >= RSSI_THRESHOLD) {
            String mac = advertisedDevice.getAddress().toString().c_str();
            mac.toUpperCase(); // Ensure casing matches Backend OUI list
            
            int rssi = advertisedDevice.getRSSI();
            String name = advertisedDevice.getName().c_str();
            if (name == "") name = "BLE Device";
            
            sendDetection(mac.c_str(), rssi, name.c_str());
        }
    }
};

void startBluetoothScan() {
  // 1. BLE Scan (5 seconds)
  Serial.println("[BLE] Scanning...");
  BLEScan* pBLEScan = BLEDevice::getScan();
  pBLEScan->start(5, false); 

  // 2. Classic BT Scan (Increase to 10 for better name discovery)
  Serial.println("[BT] Discovering...");
  esp_bt_gap_start_discovery(ESP_BT_INQ_MODE_GENERAL_INQUIRY, 10, 0); 
}

// ─── SETUP ────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  pinMode(JAMMER_PIN, OUTPUT);
  digitalWrite(JAMMER_PIN, LOW);

  connectWiFi();

  // Init Classic BT
  esp_bt_controller_config_t bt_cfg = BT_CONTROLLER_INIT_CONFIG_DEFAULT();
  esp_bt_controller_init(&bt_cfg);
  esp_bt_controller_enable(ESP_BT_MODE_CLASSIC_BT);
  esp_bluedroid_init();
  esp_bluedroid_enable();
  esp_bt_gap_register_callback(btGapCallback);
  esp_bt_gap_set_scan_mode(ESP_BT_CONNECTABLE, ESP_BT_GENERAL_DISCOVERABLE);

  // Init BLE
  BLEDevice::init(DEVICE_ID);
  BLEScan* pBLEScan = BLEDevice::getScan();
  pBLEScan->setAdvertisedDeviceCallbacks(new MyAdvertisedDeviceCallbacks());
  pBLEScan->setActiveScan(true);  // Required for name discovery
  pBLEScan->setInterval(1349);   // Recommended timing for scan response
  pBLEScan->setWindow(449);

  Serial.println("[System] Monitoring Started...");
  sendHeartbeat();
}

// ─── LOOP ─────────────────────────────────────────────────────────────────────
void loop() {
  unsigned long now = millis();

  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    delay(2000);
    return;
  }

  if (now - lastScan >= SCAN_INTERVAL_MS) {
    lastScan = now;
    startBluetoothScan();
  }

  if (now - lastHeartbeat >= HEARTBEAT_INTERVAL) {
    lastHeartbeat = now;
    sendHeartbeat();
  }
  
  delay(100);
}