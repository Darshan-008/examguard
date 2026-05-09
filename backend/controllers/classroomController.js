const Classroom = require('../models/Classroom');

exports.getClassrooms = async (req, res) => {
  try {
    const classrooms = await Classroom.find()
      .populate('blockId', 'blockName')
      .populate('floorId', 'floorName')
      .populate('esp32DeviceId')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: classrooms });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createClassroom = async (req, res) => {
  try {
    const { roomName, blockId, floorId, esp32DeviceId } = req.body;
    const classroom = await Classroom.create({ roomName, blockId, floorId, esp32DeviceId: esp32DeviceId || null });
    await classroom.populate(['blockId', 'floorId', 'esp32DeviceId']);
    res.status(201).json({ success: true, data: classroom });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateClassroom = async (req, res) => {
  try {
    const classroom = await Classroom.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after', runValidators: true })
      .populate('blockId', 'blockName')
      .populate('floorId', 'floorName')
      .populate('esp32DeviceId');
    if (!classroom) return res.status(404).json({ success: false, message: 'Classroom not found' });
    res.json({ success: true, data: classroom });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteClassroom = async (req, res) => {
  try {
    const classroom = await Classroom.findByIdAndDelete(req.params.id);
    if (!classroom) return res.status(404).json({ success: false, message: 'Classroom not found' });
    res.json({ success: true, message: 'Classroom deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
