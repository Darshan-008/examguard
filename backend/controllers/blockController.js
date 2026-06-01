const Block = require('../models/Block');

exports.getBlocks = async (req, res) => {
  try {
    const blocks = await Block.find().sort({ createdAt: -1 });
    res.json({ success: true, data: blocks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createBlock = async (req, res) => {
  try {
    const block = await Block.create({ blockName: req.body.blockName });
    const io = req.app.get('io');
    if (io) io.emit('infrastructureUpdate', { type: 'block', action: 'create', data: block });
    res.status(201).json({ success: true, data: block });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateBlock = async (req, res) => {
  try {
    const block = await Block.findByIdAndUpdate(
      req.params.id,
      { blockName: req.body.blockName },
      { new: true, runValidators: true }
    );
    if (!block) return res.status(404).json({ success: false, message: 'Block not found' });
    const io = req.app.get('io');
    if (io) io.emit('infrastructureUpdate', { type: 'block', action: 'update', data: block });
    res.json({ success: true, data: block });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteBlock = async (req, res) => {
  try {
    const block = await Block.findByIdAndDelete(req.params.id);
    if (!block) return res.status(404).json({ success: false, message: 'Block not found' });
    const io = req.app.get('io');
    if (io) io.emit('infrastructureUpdate', { type: 'block', action: 'delete', id: req.params.id });
    res.json({ success: true, message: 'Block deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
