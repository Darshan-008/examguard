const mongoose = require('mongoose');

const detectionLogSchema = new mongoose.Schema({
  classroomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
  esp32DeviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'ESP32Device', required: true },
  macAddress: { type: String, required: true, trim: true },
  rssi: { type: Number, required: true },
  deviceName: { type: String, default: 'Unknown' },
  deviceClass: { type: Number, default: 0 },
  appearance: { type: Number, default: 0 },
  category: { type: String, default: 'Unknown' },
  isRandomized: { type: Boolean, default: false },
  alertStatus: { type: String, enum: ['alert', 'cleared'], default: 'alert' },
  timestamp: { type: Date, default: Date.now },
}, { timestamps: true });

detectionLogSchema.index({ timestamp: -1 });
detectionLogSchema.index({ classroomId: 1 });

module.exports = mongoose.model('DetectionLog', detectionLogSchema);
