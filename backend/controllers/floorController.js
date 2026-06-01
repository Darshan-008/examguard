const Floor = require('../models/Floor');

exports.getFloors = async (req, res) => {
  try {
    const query = req.query.blockId ? { blockId: req.query.blockId } : {};
    const floors = await Floor.find(query).populate('blockId', 'blockName').sort({ createdAt: -1 });
    res.json({ success: true, data: floors });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createFloor = async (req, res) => {
  try {
    const floor = await Floor.create({ floorName: req.body.floorName, blockId: req.body.blockId });
    await floor.populate('blockId', 'blockName');
    const io = req.app.get('io');
    if (io) io.emit('infrastructureUpdate', { type: 'floor', action: 'create', data: floor });
    res.status(201).json({ success: true, data: floor });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateFloor = async (req, res) => {
  try {
    const floor = await Floor.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate('blockId', 'blockName');
    if (!floor) return res.status(404).json({ success: false, message: 'Floor not found' });
    const io = req.app.get('io');
    if (io) io.emit('infrastructureUpdate', { type: 'floor', action: 'update', data: floor });
    res.json({ success: true, data: floor });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteFloor = async (req, res) => {
  try {
    const floor = await Floor.findByIdAndDelete(req.params.id);
    if (!floor) return res.status(404).json({ success: false, message: 'Floor not found' });
    const io = req.app.get('io');
    if (io) io.emit('infrastructureUpdate', { type: 'floor', action: 'delete', id: req.params.id });
    res.json({ success: true, message: 'Floor deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
