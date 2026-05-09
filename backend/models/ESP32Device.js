const mongoose = require('mongoose');

const esp32DeviceSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true, trim: true },
  classroomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', default: null },
  ipAddress: { type: String, trim: true, default: '' },
  status: { type: String, enum: ['online', 'offline'], default: 'offline' },
  jammerStatus: { type: String, enum: ['active', 'inactive'], default: 'inactive' },
  monitoringStatus: { type: String, enum: ['active', 'inactive'], default: 'active' },
  rssiThreshold: { type: Number, default: -85 }, // Devices with RSSI lower than this will be ignored
  lastSeen: { type: Date, default: null },
  firmwareVersion: { type: String, default: '1.0.0' },
}, { timestamps: true });

module.exports = mongoose.model('ESP32Device', esp32DeviceSchema);
