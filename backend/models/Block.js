const mongoose = require('mongoose');

const blockSchema = new mongoose.Schema({
  blockName: { type: String, required: true, trim: true, unique: true },
}, { timestamps: true });

module.exports = mongoose.model('Block', blockSchema);
