const mongoose = require('mongoose');

const classroomSchema = new mongoose.Schema({
  roomName: { type: String, required: true, trim: true },
  blockId: { type: mongoose.Schema.Types.ObjectId, ref: 'Block', required: true },
  floorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Floor', required: true },
  esp32DeviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'ESP32Device', default: null },
  alertStatus: { type: Boolean, default: false },
  lastDetectionTime: { type: Date, default: null },
  totalDetections: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Classroom', classroomSchema);
