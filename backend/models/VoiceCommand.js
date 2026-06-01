const mongoose = require('mongoose');

const VoiceCommandSchema = new mongoose.Schema({
  text: { type: String, required: true, trim: true },
  intent: { type: String, default: 'unknown' },
  action: { type: String, default: 'unknown' },
  target: { type: mongoose.Schema.Types.Mixed, default: null },
  response: { type: mongoose.Schema.Types.Mixed, default: null },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = mongoose.model('VoiceCommand', VoiceCommandSchema);
