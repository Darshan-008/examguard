# 🔵 Bluetooth Detection Monitoring System

A production-ready full-stack system for monitoring Bluetooth device activity in examination halls using ESP32 devices, with real-time alerts and a modern admin dashboard.

---

## 🏗️ Project Structure

```
major project/
├── backend/          → Node.js + Express + MongoDB + Socket.IO
├── frontend/         → React.js + Tailwind CSS + Chart.js
└── esp32/            → Arduino firmware for ESP32 DevKit V1
```

---

## ⚙️ Prerequisites

| Tool | Version |
|------|---------|
| Node.js | v18+ |
| MongoDB | v6+ (local or Atlas) |
| Arduino IDE | v2.x |
| ESP32 Board Package | Espressif v2.x |

---

## 🚀 Quick Start

### 1. Start MongoDB
```bash
mongod --dbpath C:/data/db
```

### 2. Backend Setup
```bash
cd backend
npm install
# Edit .env → set MONGO_URI, JWT_SECRET
npm run seed       # Seed demo data
npm run dev        # Start dev server on :5000
```

### 3. Frontend Setup
```bash
cd frontend
npm install
# Edit .env → set REACT_APP_API_URL if needed
npm start          # Start on :3000
```

---

## 🔐 Demo Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@btmonitor.com | admin123 |
| Supervisor | supervisor@btmonitor.com | exam1234 |

---

## 📡 Backend API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | — | Login |
| POST | `/api/auth/register` | — | Register |
| GET | `/api/blocks` | ✅ | List blocks |
| POST | `/api/blocks` | Admin | Create block |
| GET | `/api/floors` | ✅ | List floors |
| GET | `/api/classrooms` | ✅ | List classrooms |
| GET | `/api/devices` | ✅ | List ESP32 devices |
| PUT | `/api/devices/:id/jammer` | ✅ | Toggle jammer |
| POST | `/api/devices/heartbeat` | — | ESP32 heartbeat |
| POST | `/api/detection` | — | Post detection (ESP32) |
| GET | `/api/detection/logs` | ✅ | Get detection logs |
| GET | `/api/detection/analytics` | ✅ | Get chart data |
| GET | `/api/dashboard/stats` | Admin | Dashboard stats |

---

## 🔌 Socket.IO Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `bluetoothAlert` | Server→Client | New BT detection |
| `jammerUpdate` | Server→Client | Jammer status changed |
| `deviceStatus` | Server→Client | Device online/offline |
| `alertCleared` | Server→Client | Room alert cleared |
| `clearAlert` | Client→Server | Clear room alert |
| `deviceOnline` | Client→Server | ESP32 came online |

---

## 📟 ESP32 Setup

1. Open `esp32/bluetooth_monitor/bluetooth_monitor.ino` in Arduino IDE
2. Install required libraries:
   - **ArduinoJson** (Benoit Blanchon)
3. Configure your credentials:
   ```cpp
   const char* WIFI_SSID    = "YOUR_WIFI_SSID";
   const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
   const char* BACKEND_URL  = "http://YOUR_SERVER_IP:5000";
   const char* DEVICE_ID    = "ESP32-A101"; // Must match DB
   ```
4. Select **ESP32 Dev Module** as board
5. Flash and monitor via Serial at 115200 baud

### ESP32 Behavior
- Scans Bluetooth every **5 seconds**
- Sends heartbeat every **30 seconds**
- Receives jammer command on heartbeat response
- GPIO pin 2 controls jammer relay (HIGH = active)
- Auto-reconnects WiFi on disconnect

---

## 🖥️ Frontend Pages

| Page | Role | Description |
|------|------|-------------|
| `/login` | All | Secure login |
| `/dashboard` | Admin | Stats, charts, recent alerts |
| `/monitoring` | All | Live classroom grid |
| `/blocks` | Admin | Block management |
| `/floors` | Admin | Floor management |
| `/classrooms` | Admin | Classroom management |
| `/devices` | Admin | ESP32 devices + jammer |
| `/logs` | All | Detection log table |
| `/users` | Admin | User management |
| `/reports` | All | Analytics & heatmap |

---

## 🗃️ Database Schema

```
Users          → name, email, password(hashed), role
Blocks         → blockName
Floors         → floorName, blockId
Classrooms     → roomName, blockId, floorId, esp32DeviceId
ESP32Devices   → deviceId, classroomId, ipAddress, status, jammerStatus
DetectionLogs  → classroomId, esp32DeviceId, macAddress, rssi, deviceName, alertStatus
```

---

## 🎨 UI Features

- ✅ Dark glassmorphism design
- ✅ Real-time socket alerts with sound
- ✅ RED/GREEN/GRAY classroom cards
- ✅ Animated alert pulsing
- ✅ Jammer toggle switch
- ✅ CSV export for logs
- ✅ Chart.js analytics
- ✅ Collapsible sidebar
- ✅ Role-based access control
- ✅ Mobile responsive

---

## 🔒 Security Features

- JWT authentication (7-day expiry)
- bcrypt password hashing (cost 12)
- Role-based route guards (Admin / ExamUser)
- Rate limiting (500 req/15min)
- Helmet.js HTTP security headers
- Protected API routes

---

## 📦 Deployment

### Backend (PM2)
```bash
npm install -g pm2
cd backend
pm2 start server.js --name bt-monitor-api
pm2 save
```

### Frontend (Build)
```bash
cd frontend
npm run build
# Serve build/ with nginx or serve package
npx serve -s build -l 3000
```

### Environment Variables (Production)
```
MONGO_URI=mongodb+srv://...   # MongoDB Atlas URI
JWT_SECRET=<strong-random-key>
NODE_ENV=production
FRONTEND_URL=https://your-domain.com
```

