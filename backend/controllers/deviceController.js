const ESP32Device = require('../models/ESP32Device');
const Classroom = require('../models/Classroom');

exports.getDevices = async (req, res) => {
  try {
    const devices = await ESP32Device.find()
      .populate({ path: 'classroomId', populate: [{ path: 'blockId', select: 'blockName' }, { path: 'floorId', select: 'floorName' }] })
      .sort({ createdAt: -1 });
    res.json({ success: true, data: devices });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createDevice = async (req, res) => {
  try {
    const { deviceId, classroomId, ipAddress } = req.body;
    const device = await ESP32Device.create({ deviceId, classroomId: classroomId || null, ipAddress });
    if (classroomId) {
      await Classroom.findByIdAndUpdate(classroomId, { esp32DeviceId: device._id });
    }
    res.status(201).json({ success: true, data: device });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateDevice = async (req, res) => {
  try {
    const device = await ESP32Device.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after', runValidators: true });
    if (!device) return res.status(404).json({ success: false, message: 'Device not found' });
    res.json({ success: true, data: device });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteDevice = async (req, res) => {
  try {
    const device = await ESP32Device.findByIdAndDelete(req.params.id);
    if (!device) return res.status(404).json({ success: false, message: 'Device not found' });
    res.json({ success: true, message: 'Device deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.toggleJammer = async (req, res) => {
  try {
    const device = await ESP32Device.findById(req.params.id);
    if (!device) return res.status(404).json({ success: false, message: 'Device not found' });

    const newStatus = device.jammerStatus === 'active' ? 'inactive' : 'active';
    device.jammerStatus = newStatus;
    await device.save();

    // Emit socket event for real-time update
    const io = req.app.get('io');
    if (io) {
      io.emit('jammerUpdate', { deviceId: device._id, classroomId: device.classroomId, jammerStatus: newStatus });
    }

    res.json({ success: true, data: device, jammerStatus: newStatus });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.toggleMonitoring = async (req, res) => {
  try {
    const device = await ESP32Device.findById(req.params.id);
    if (!device) return res.status(404).json({ success: false, message: 'Device not found' });

    const newStatus = device.monitoringStatus === 'active' ? 'inactive' : 'active';
    device.monitoringStatus = newStatus;
    
    // If we turn off monitoring, also turn off the jammer for safety
    if (newStatus === 'inactive') device.jammerStatus = 'inactive';
    
    await device.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('deviceUpdate', { deviceId: device._id, monitoringStatus: newStatus, jammerStatus: device.jammerStatus });
    }

    res.json({ success: true, data: device, monitoringStatus: newStatus });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.heartbeat = async (req, res) => {
  try {
    const { deviceId, ipAddress } = req.body;
    const device = await ESP32Device.findOneAndUpdate(
      { deviceId },
      { status: 'online', lastSeen: new Date(), ipAddress: ipAddress || undefined },
      { returnDocument: 'after' }
    );
    if (!device) return res.status(404).json({ success: false, message: 'Device not found' });

    const io = req.app.get('io');
    if (io) io.emit('deviceStatus', { deviceId: device._id, status: 'online' });

    res.json({ 
      success: true, 
      jammerStatus: device.jammerStatus,
      monitoringStatus: device.monitoringStatus 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
