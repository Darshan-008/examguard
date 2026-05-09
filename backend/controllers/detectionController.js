const DetectionLog = require('../models/DetectionLog');
const Classroom = require('../models/Classroom');
const ESP32Device = require('../models/ESP32Device');

const getCategory = (cod, appearance, name = '') => {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('watch') || lowerName.includes('fit') || lowerName.includes('band') || lowerName.includes('gear') || lowerName.includes('amazfit') || lowerName.includes('wear')) return 'Smart Watch';
  if (lowerName.includes('phone') || lowerName.includes('mobile') || lowerName.includes('galaxy') || lowerName.includes('iphone') || lowerName.includes('pixel') || lowerName.includes('redmi') || lowerName.includes('oneplus')) return 'Smart Phone';
  if (lowerName.includes('buds') || lowerName.includes('head') || lowerName.includes('airpods') || lowerName.includes('audio') || lowerName.includes('speaker') || lowerName.includes('tune') || lowerName.includes('echo') || lowerName.includes('dot')) return 'Audio Device';
  if (lowerName.includes('laptop') || lowerName.includes('macbook') || lowerName.includes('pc') || lowerName.includes('desktop') || lowerName.includes('computer')) return 'Computer';

  if (appearance >= 64 && appearance <= 79) return 'Smart Phone';
  if (appearance >= 128 && appearance <= 191) return 'Computer';
  if (appearance >= 192 && appearance <= 255) return 'Smart Watch';
  if (appearance >= 1024 && appearance <= 1087) return 'Audio Device';

  if (cod) {
    const major = (cod >> 8) & 0x1F;
    switch (major) {
      case 1: return 'Computer';
      case 2: return 'Smart Phone';
      case 3: return 'Network Device';
      case 4: return 'Audio Device';
      case 5: return 'Peripheral';
      case 6: return 'Imaging';
      case 7: return 'Wearable/Watch';
      default: return 'Other BT Device';
    }
  }
  return 'Bluetooth Device';
};

const getManufacturer = (mac) => {
  // Check for randomized MAC address (Locally Administered)
  // The second least significant bit of the first byte indicates if the address is locally administered.
  const firstByte = parseInt(mac.substring(0, 2), 16);
  if (firstByte & 0x02) {
    return 'Randomized MAC';
  }

  const oui = mac.substring(0, 8).toUpperCase();
  const manufacturers = {
    // Apple
    '00:A0:C9': 'Apple', '00:25:00': 'Apple', 'AC:29:3A': 'Apple', 'F0:18:98': 'Apple',
    '3C:A5:81': 'Apple', 'B8:C7:5D': 'Apple', 'D0:03:4B': 'Apple', '60:F8:1D': 'Apple',
    'BC:FE:D9': 'Apple', 'F4:0F:24': 'Apple', 'E4:E4:AB': 'Apple', 'D4:A3:3D': 'Apple',
    '00:03:93': 'Apple', '00:05:02': 'Apple', 'D0:81:C5': 'Apple', 'D0:88:0C': 'Apple',
    'F4:F9:51': 'Apple', 'F4:FE:3E': 'Apple', 'F8:03:77': 'Apple',
    // Samsung
    '00:00:F0': 'Samsung', '00:07:AB': 'Samsung', '18:67:B0': 'Samsung', '38:AA:3C': 'Samsung',
    '44:91:60': 'Samsung', '50:85:69': 'Samsung', 'A8:7D:12': 'Samsung', '90:B6:86': 'Samsung',
    '00:E0:64': 'Samsung', '08:7E:E2': 'Samsung', '64:1B:2F': 'Samsung', '84:25:19': 'Samsung',
    '9C:73:B1': 'Samsung', '38:8A:06': 'Samsung', 'F8:04:2E': 'Samsung',
    // Xiaomi / Redmi
    'BC:5F:F4': 'Xiaomi', '64:9E:F3': 'Xiaomi', '04:D6:AA': 'Xiaomi', '28:6C:07': 'Xiaomi',
    'AC:F7:F3': 'Xiaomi', 'D4:9E:3B': 'Xiaomi', '00:9E:C8': 'Xiaomi', '04:CF:8C': 'Xiaomi',
    '0C:F3:46': 'Xiaomi', '1C:2A:B0': 'Xiaomi', '1C:EA:AC': 'Xiaomi', 'CC:EB:5E': 'Xiaomi',
    'F4:F5:DB': 'Xiaomi',
    // Oppo / Vivo / OnePlus / Realme / BBK
    '4C:5E:0C': 'Oppo', '78:F8:82': 'Oppo', 'E0:60:66': 'Vivo', '94:D0:6A': 'OnePlus',
    'A0:AB:51': 'OnePlus', '64:44:50': 'Realme', 'D8:21:5E': 'Realme', 
    // Audio Specialist
    '20:C3:56': 'JBL/Harman', 'C4:3A:8D': 'JBL/Harman', 'F4:F3:AA': 'JBL',
    '00:0C:8A': 'Bose', '04:52:C7': 'Bose', '08:DF:1F': 'Bose', 'D0:F8:8C': 'Bose',
    '00:1E:AE': 'Sennheiser', '00:22:37': 'Sennheiser',
    // Sony
    '00:04:1F': 'Sony', '00:13:15': 'Sony', '00:15:C1': 'Sony', 'AC:80:0A': 'Sony', 'F8:D0:BD': 'Sony',
    // Others
    '00:E0:4C': 'Realtek', 'F8:E6:1A': 'TP-Link', '00:0C:E7': 'Intel', 'DC:A6:32': 'Raspberry Pi',
    'B8:27:EB': 'Raspberry Pi', '8C:FD:F0': 'Huawei', '70:A8:E3': 'Huawei', '00:1A:11': 'Google',
    'DA:A1:19': 'Google', '00:04:4B': 'Nvidia', '00:22:6B': 'Cisco', '20:C3:56': 'D-Link'
  };
  return manufacturers[oui] || 'Generic';
};

exports.postDetection = async (req, res) => {
  try {
    let { deviceId, macAddress, rssi, deviceName, classroomId, deviceClass, appearance } = req.body;
    
    // Normalize MAC address to Uppercase
    if (macAddress) {
      macAddress = macAddress.toUpperCase();
      // Ensure colons if they are missing (assuming 12 hex chars)
      if (macAddress.length === 12 && !macAddress.includes(':')) {
        macAddress = macAddress.match(/.{1,2}/g).join(':');
      }
    }

    console.log(`[Alert] Incoming from ${deviceId} - MAC: ${macAddress}`);

    // Find ESP32 device
    const device = await ESP32Device.findOne({ deviceId });
    if (!device) return res.status(404).json({ success: false, message: 'Device not registered' });

    // BLOCK LOGGING IF INACTIVE
    if (device.monitoringStatus === 'inactive') {
      return res.status(403).json({ success: false, message: 'Monitoring is currently disabled for this device' });
    }

    // RSSI FILTERING
    const threshold = device.rssiThreshold || -85;
    if (rssi < threshold) {
      return res.status(200).json({ success: true, message: 'Detection ignored due to low signal (outside range)' });
    }

    const roomId = classroomId || device.classroomId;
    if (!roomId) return res.status(400).json({ success: false, message: 'No classroom assigned' });

    // COOLDOWN: Don't log the same device in the same room within 2 minutes
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const existingLog = await DetectionLog.findOne({
      classroomId: roomId,
      macAddress: macAddress,
      timestamp: { $gte: twoMinutesAgo }
    });

    if (existingLog) {
      // Update the existing log's timestamp and RSSI instead of creating a new one to reduce spam
      existingLog.timestamp = new Date();
      existingLog.rssi = rssi;
      await existingLog.save();
      return res.status(200).json({ success: true, message: 'Existing detection updated (cooldown active)', data: existingLog });
    }

    // Create log
    const brand = getManufacturer(macAddress);
    let finalName = deviceName;

    if (deviceName === 'Unknown' || deviceName === 'BLE Device' || !deviceName) {
      if (brand === 'Randomized MAC') {
        finalName = 'Mobile Device (Private MAC)';
      } else if (brand === 'Generic') {
        finalName = 'Unknown Bluetooth Device';
      } else {
        finalName = `${brand} Device`;
      }
    }

    const log = await DetectionLog.create({
      esp32DeviceId: device._id,
      classroomId: roomId,
      macAddress,
      rssi,
      deviceName: finalName,
      deviceClass: deviceClass || 0,
      appearance: appearance || 0,
      category: getCategory(deviceClass, appearance, finalName),
      alertStatus: 'alert',
    });

    // AUTO-JAMMER: Automatically turn on jammer for this device
    if (device.jammerStatus !== 'active') {
      device.jammerStatus = 'active';
      await device.save();
    }

    // Update classroom alert status and counts
    await Classroom.findByIdAndUpdate(roomId, {
      alertStatus: true,
      lastDetectionTime: new Date(),
      $inc: { totalDetections: 1 },
    });

    // Populate and emit socket event
    await log.populate([
      { path: 'classroomId', populate: [{ path: 'blockId', select: 'blockName' }, { path: 'floorId', select: 'floorName' }] },
      { path: 'esp32DeviceId', select: 'deviceId' },
    ]);

    const io = req.app.get('io');
    if (io) {
      // Notify about the alert
      io.emit('bluetoothAlert', {
        log,
        classroomId: roomId,
        macAddress,
        rssi,
        deviceName: deviceName || 'Unknown',
        timestamp: log.timestamp,
      });

      // Notify about the automatic jammer activation
      io.emit('jammerUpdate', {
        deviceId: device._id,
        jammerStatus: 'active',
      });
    }

    res.status(201).json({ success: true, data: log });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const query = {};
    if (req.query.classroomId) query.classroomId = req.query.classroomId;
    if (req.query.macAddress) query.macAddress = { $regex: req.query.macAddress, $options: 'i' };
    if (req.query.startDate || req.query.endDate) {
      query.timestamp = {};
      if (req.query.startDate) query.timestamp.$gte = new Date(req.query.startDate);
      if (req.query.endDate) query.timestamp.$lte = new Date(req.query.endDate);
    }

    const [logs, total] = await Promise.all([
      DetectionLog.find(query)
        .populate({ path: 'classroomId', populate: [{ path: 'blockId', select: 'blockName' }, { path: 'floorId', select: 'floorName' }] })
        .populate('esp32DeviceId', 'deviceId')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit),
      DetectionLog.countDocuments(query),
    ]);

    res.json({ success: true, data: logs, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getTodayStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const count = await DetectionLog.countDocuments({ timestamp: { $gte: today } });
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAnalytics = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const data = await DetectionLog.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const classroomHeatmap = await DetectionLog.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      { $group: { _id: '$classroomId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'classrooms', localField: '_id', foreignField: '_id', as: 'classroom' } },
      { $unwind: '$classroom' },
    ]);

    res.json({ success: true, data, classroomHeatmap });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.clearLogs = async (req, res) => {
  try {
    await DetectionLog.deleteMany({});
    res.json({ success: true, message: 'All detection logs have been cleared' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
