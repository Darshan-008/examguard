const User = require('../models/User');

exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { name, role, isActive, assignedClassrooms } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, role, isActive, assignedClassrooms },
      { new: true, runValidators: true }
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const Block = require('../models/Block');
    const Floor = require('../models/Floor');
    const Classroom = require('../models/Classroom');
    const ESP32Device = require('../models/ESP32Device');
    const DetectionLog = require('../models/DetectionLog');

    const today = new Date(); today.setHours(0, 0, 0, 0);

    const [blocks, floors, classrooms, activeDevices, todayAlerts, jammerActive] = await Promise.all([
      Block.countDocuments(),
      Floor.countDocuments(),
      Classroom.countDocuments(),
      ESP32Device.countDocuments({ status: 'online' }),
      DetectionLog.countDocuments({ timestamp: { $gte: today } }),
      ESP32Device.countDocuments({ jammerStatus: 'active' }),
    ]);

    res.json({ success: true, data: { blocks, floors, classrooms, activeDevices, todayAlerts, jammerActive } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
