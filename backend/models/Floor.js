const mongoose = require('mongoose');

const floorSchema = new mongoose.Schema({
  floorName: { type: String, required: true, trim: true },
  blockId: { type: mongoose.Schema.Types.ObjectId, ref: 'Block', required: true },
}, { timestamps: true });

module.exports = mongoose.model('Floor', floorSchema);
