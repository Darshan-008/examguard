const VoiceCommand = require('../models/VoiceCommand');
const ESP32Device = require('../models/ESP32Device');
const DetectionLog = require('../models/DetectionLog');
const Block = require('../models/Block');
const Floor = require('../models/Floor');
const Classroom = require('../models/Classroom');
const User = require('../models/User');

const macRegex = /([0-9A-Fa-f]{2}(?::|-)?){5}[0-9A-Fa-f]{2}/;
const esp32Regex = /\b(ESP[-_ ]?32[-_ ]?[A-Z0-9]+)\b/i;
const deviceNameRegex = /\bdevice\s+([A-Z0-9-]+)\b/i;

function normalizeDeviceId(value) {
  if (!value) return null;
  // Remove spaces/underscores and make uppercase
  const normalized = value.toUpperCase().replace(/[\s_]+/g, '-').replace(/^ESP-32/, 'ESP32');
  return normalized.startsWith('ESP32') ? normalized : `ESP32-${normalized}`;
}

// ─── INTENT PARSER ─────────────────────────────────────────────────────────
function parseIntent(text) {
  const original = text.trim();
  const lower = original.toLowerCase();

  // Extract device identifiers
  const deviceMatch = esp32Regex.exec(original) || deviceNameRegex.exec(original);
  const deviceId = normalizeDeviceId(deviceMatch ? deviceMatch[1] : null);
  const macMatch = macRegex.exec(original);
  const targetAll =
    /\ball\b/.test(lower) ||
    /all devices/.test(lower) ||
    /every device/.test(lower) ||
    /all esp/.test(lower);

  const parsed = {
    intent: 'unknown',
    action: 'unknown',
    route: null,
    deviceId: deviceId || null,
    macAddress: macMatch ? macMatch[0].replace(/-/g, ':').toUpperCase() : null,
    target: targetAll ? 'all' : null,
    raw: original,
    // Infrastructure fields
    blockName: null,
    floorName: null,
    roomName: null,
    parentBlockName: null,
    parentFloorName: null,
  };

  // ── WAKE WORD ────────────────────────────────────────────────────────────
  if (/\b(hey\s+examguard|examguard)\b/.test(lower)) {
    parsed.intent = 'wake';
  }

  // ── LOGOUT ──────────────────────────────────────────────────────────────
  if (/\b(log\s*out|sign\s*out|sign\s*off)\b/.test(lower)) {
    parsed.intent = 'logout';
    parsed.action = 'logout';
    return parsed;
  }

  // ── NAVIGATION ───────────────────────────────────────────────────────────
  // Check navigation intent – only when no action keywords are present
  const hasActionKeywords = /\b(on|off|enable|disable|start|stop|add|create|new|register|turn|toggle|jammer|delete|remove|export|download|clear|wipe|erase|how|what|which|explain|summarize|detail|summary)\b/.test(lower);

  if (!hasActionKeywords) {
    const navMap = [
      { pattern: /\b(dashboard|home)\b/, route: '/dashboard' },
      { pattern: /\b(infrastructure|map|location|floor|block|campus)\b/, route: '/infrastructure' },
      { pattern: /\b(devices?|esp32)\b/, route: '/devices' },
      { pattern: /\b(logs?|alerts?|detection)\b/, route: '/logs' },
      { pattern: /\b(monitor(?:ing|e)?|live\s*monitor)\b/, route: '/monitoring' },
      { pattern: /\b(users?|user\s*management)\b/, route: '/users' },
      { pattern: /\b(reports?|analytics|statistics)\b/, route: '/reports' },
    ];

    const navMatch = navMap.find((n) => n.pattern.test(lower));
    if (navMatch) {
      parsed.intent = 'navigate';
      parsed.action = 'navigate';
      parsed.route = navMatch.route;
      return parsed;
    }
  }

  // ── SHOW / VIEW shortcuts ────────────────────────────────────────────────
  if (/(?:show|view|list)\b.*\b(?:devices?|esp32)/.test(lower)) {
    parsed.intent = 'navigate';
    parsed.action = 'navigate';
    parsed.route = '/devices';
    return parsed;
  }
  if (/(?:show|view)\b.*\b(?:alert|detection|log)/.test(lower)) {
    parsed.intent = 'navigate';
    parsed.action = 'navigate';
    parsed.route = '/logs';
    return parsed;
  }
  if (/(?:show|view)\b.*\b(?:report|analytics|statistics)/.test(lower)) {
    parsed.intent = 'navigate';
    parsed.action = 'navigate';
    parsed.route = '/reports';
    return parsed;
  }
  if (/(?:show|view)\b.*\b(?:infrastructure|campus|block|floor)/.test(lower)) {
    parsed.intent = 'navigate';
    parsed.action = 'navigate';
    parsed.route = '/infrastructure';
    return parsed;
  }

  // ── INFRASTRUCTURE: ADD BLOCK ─────────────────────────────────────────────
  // "add block Block A" / "create block Engineering Block" / "add new block Block B"
  const addBlockMatch = /(?:add|create|new)\s+(?:a\s+)?(?:new\s+)?block\s+(.+)/i.exec(original);
  if (addBlockMatch) {
    parsed.intent = 'add_block';
    parsed.action = 'add_block';
    parsed.blockName = addBlockMatch[1].trim();
    return parsed;
  }

  // ── INFRASTRUCTURE: ADD FLOOR ─────────────────────────────────────────────
  // "add floor 2nd Floor to block Block A" / "create floor Ground Floor in Block B"
  const addFloorMatch =
    /(?:add|create|new)\s+(?:a\s+)?(?:new\s+)?floor\s+(.+?)\s+(?:to|in|for|under)\s+block\s+(.+)/i.exec(
      original
    ) ||
    /(?:add|create|new)\s+(?:a\s+)?(?:new\s+)?floor\s+(.+)/i.exec(original);

  if (addFloorMatch) {
    parsed.intent = 'add_floor';
    parsed.action = 'add_floor';
    parsed.floorName = addFloorMatch[1].trim();
    parsed.parentBlockName = addFloorMatch[2] ? addFloorMatch[2].trim() : null;
    return parsed;
  }

  // ── INFRASTRUCTURE: ADD CLASSROOM / ROOM ─────────────────────────────────
  // "add classroom Room 101 to floor 1st Floor" / "add room 203 in floor Ground Floor"
  const addRoomMatch =
    /(?:add|create|new)\s+(?:a\s+)?(?:new\s+)?(?:classroom|room)\s+(.+?)\s+(?:to|in|for|on)\s+(?:floor\s+)?(.+)/i.exec(
      original
    ) ||
    /(?:add|create|new)\s+(?:a\s+)?(?:new\s+)?(?:classroom|room)\s+(.+)/i.exec(original);

  if (addRoomMatch) {
    parsed.intent = 'add_classroom';
    parsed.action = 'add_classroom';
    parsed.roomName = addRoomMatch[1].trim();
    parsed.parentFloorName = addRoomMatch[2] ? addRoomMatch[2].trim() : null;
    return parsed;
  }

  // ── USER MANAGEMENT: ADD / DELETE USER ───────────────────────────────────
  const addUserMatch = /(?:add|create|new)\s+(?:a\s+)?(?:new\s+)?user\s+(.+)/i.exec(original);
  if (addUserMatch) {
    parsed.intent = 'add_user';
    parsed.action = 'add_user';
    parsed.target = addUserMatch[1].trim(); // Name of user
    return parsed;
  }

  const deleteUserMatch = /(?:delete|remove)\s+(?:the\s+)?user\s+(.+)/i.exec(original);
  if (deleteUserMatch) {
    parsed.intent = 'delete_user';
    parsed.action = 'delete_user';
    parsed.target = deleteUserMatch[1].trim(); // Name of user
    return parsed;
  }

  // ── ESP32 DEVICE: MONITORING ON/OFF ──────────────────────────────────────
  // "turn on ESP32-A101" / "ESP32-A101 on" / "enable monitoring ESP32-A101"
  const deviceOnPatterns = [
    /(?:turn\s+on|enable|start|power\s+on|activate)\s+(?:monitoring\s+(?:for\s+)?)?(?:device\s+)?(.+)/i,
    /(?:device\s+)?(.+?)\s+(?:on|enable|start)/i,
  ];
  const deviceOffPatterns = [
    /(?:turn\s+off|disable|stop|power\s+off|deactivate)\s+(?:monitoring\s+(?:for\s+)?)?(?:device\s+)?(.+)/i,
    /(?:device\s+)?(.+?)\s+(?:off|disable|stop)/i,
  ];

  // Simple "on" / "off" for named devices – highest specificity
  if (/\b(turn\s+on|enable|start|power\s+on|activate)\b/.test(lower) && !(/jammer/i.test(lower))) {
    if (deviceId || targetAll) {
      parsed.intent = 'device_on';
      parsed.action = 'device_on';
      return parsed;
    }
  }
  if (/\b(turn\s+off|disable|stop|power\s+off|deactivate)\b/.test(lower) && !(/jammer/i.test(lower))) {
    if (deviceId || targetAll) {
      parsed.intent = 'device_off';
      parsed.action = 'device_off';
      return parsed;
    }
  }

  // Pattern: "ESP32-A101 on" or "ESP32-A101 off"
  if (deviceId) {
    if (/\bon\b/.test(lower) && !/jammer/.test(lower)) {
      parsed.intent = 'device_on';
      parsed.action = 'device_on';
      return parsed;
    }
    if (/\boff\b/.test(lower) && !/jammer/.test(lower)) {
      parsed.intent = 'device_off';
      parsed.action = 'device_off';
      return parsed;
    }
  }

  // "all on" / "all off"
  if (targetAll) {
    if (/\bon\b/.test(lower) && !/jammer/.test(lower)) {
      parsed.intent = 'device_on';
      parsed.action = 'device_on';
      return parsed;
    }
    if (/\boff\b/.test(lower) && !/jammer/.test(lower)) {
      parsed.intent = 'device_off';
      parsed.action = 'device_off';
      return parsed;
    }
  }

  // ── JAMMER CONTROL ────────────────────────────────────────────────────────
  if (/(?:turn\s+on|enable|activate)\b.*\bjammer\b/.test(lower)) {
    parsed.intent = 'jammer_on';
    parsed.action = 'jammer_on';
    return parsed;
  }
  if (/(?:turn\s+off|disable|deactivate)\b.*\bjammer\b/.test(lower)) {
    parsed.intent = 'jammer_off';
    parsed.action = 'jammer_off';
    return parsed;
  }

  // ── MONITORING TOGGLE ─────────────────────────────────────────────────────
  if (/(?:turn\s+on|start|enable)\b.*\bmonitor(?:ing)?\b/.test(lower) || /monitor(?:ing)?\s+on/.test(lower)) {
    parsed.intent = 'monitoring_on';
    parsed.action = 'monitoring_on';
    return parsed;
  }
  if (/(?:turn\s+off|stop|disable)\b.*\bmonitor(?:ing)?\b/.test(lower) || /monitor(?:ing)?\s+off/.test(lower)) {
    parsed.intent = 'monitoring_off';
    parsed.action = 'monitoring_off';
    return parsed;
  }

  // ── LOCATE / FIND NEAREST ─────────────────────────────────────────────────
  if (/(locate|find).*(nearest|closest).*device/.test(lower) || /find.*nearest.*device/.test(lower)) {
    parsed.intent = 'find_nearest';
    parsed.action = 'find_nearest';
    return parsed;
  }

  // ── GENERATE REPORT ───────────────────────────────────────────────────────
  if (/(generate|create|show|make).*(report|analytics)/.test(lower)) {
    parsed.intent = 'generate_report';
    parsed.action = 'generate_report';
    parsed.route = '/reports';
    return parsed;
  }

  // ── EXPLAIN / SUMMARIZE REPORT ────────────────────────────────────────────
  if (/(explain|summarize|detail|summary).*(report|analytics|statistics)/.test(lower)) {
    parsed.intent = 'analytics_explain_report';
    parsed.action = 'analytics_explain_report';
    parsed.route = '/reports';
    return parsed;
  }

  // ── SEARCH STUDENT ────────────────────────────────────────────────────────
  if (/search.*student/.test(lower) || /find.*student/.test(lower)) {
    parsed.intent = 'search_student';
    parsed.action = 'search_student';
    const query = lower.replace(/search|find|student|for|me|the|a/g, '').trim();
    parsed.target = query || null;
    return parsed;
  }

  // ── INFRASTRUCTURE & DEVICE: DELETIONS ──────────────────────────────────
  const deleteBlockMatch = /(?:delete|remove)\s+(?:the\s+)?block\s+(.+)/i.exec(original);
  if (deleteBlockMatch) {
    parsed.intent = 'delete_block';
    parsed.action = 'delete_block';
    parsed.blockName = deleteBlockMatch[1].trim();
    return parsed;
  }

  const deleteFloorMatch = /(?:delete|remove)\s+(?:the\s+)?floor\s+(.+)/i.exec(original);
  if (deleteFloorMatch) {
    parsed.intent = 'delete_floor';
    parsed.action = 'delete_floor';
    parsed.floorName = deleteFloorMatch[1].trim();
    return parsed;
  }

  const deleteRoomMatch = /(?:delete|remove)\s+(?:the\s+)?(?:classroom|room)\s+(.+)/i.exec(original);
  if (deleteRoomMatch) {
    parsed.intent = 'delete_classroom';
    parsed.action = 'delete_classroom';
    parsed.roomName = deleteRoomMatch[1].trim();
    return parsed;
  }

  if (/(?:delete|remove)\s+(?:the\s+)?device/i.test(lower) && deviceId) {
    parsed.intent = 'delete_device';
    parsed.action = 'delete_device';
    return parsed;
  }

  // ── DATA MANAGEMENT (CLEAR & EXPORT) ──────────────────────────────────────
  if (/(?:clear|delete|wipe|erase)\s+(?:all\s+)?(?:logs?|alerts?|detections?|history)/.test(lower)) {
    parsed.intent = 'clear_logs';
    parsed.action = 'clear_logs';
    return parsed;
  }

  if (/(?:export|download)\s+(?:the\s+)?(?:logs?|alerts?|data|csv)/.test(lower)) {
    parsed.intent = 'export_logs';
    parsed.action = 'export_logs';
    return parsed;
  }

  // ── CONVERSATIONAL ANALYTICS ──────────────────────────────────────────────
  if (/(?:how\s+many|what\s+is\s+the\s+number\s+of)\s+(?:nearest|nearby|close)\s+devices?/.test(lower)) {
    parsed.intent = 'analytics_nearest_devices';
    parsed.action = 'analytics_nearest_devices';
    return parsed;
  }
  if (/(?:how\s+many|what\s+is\s+the\s+number\s+of)\s+devices?\s+(?:are\s+)?online/.test(lower)) {
    parsed.intent = 'analytics_online_devices';
    parsed.action = 'analytics_online_devices';
    return parsed;
  }

  if (/(?:how\s+many|what\s+is\s+the\s+number\s+of)\s+(?:alerts?|detections?|logs?)/.test(lower)) {
    parsed.intent = 'analytics_total_alerts';
    parsed.action = 'analytics_total_alerts';
    return parsed;
  }

  if (/(?:what|which)\s+(?:is\s+the\s+)?(?:most\s+active|busiest)\s+(?:room|classroom)/.test(lower)) {
    parsed.intent = 'analytics_most_active_room';
    parsed.action = 'analytics_most_active_room';
    return parsed;
  }

  return parsed;
}

// ─── DEVICE CONTROL HELPER ────────────────────────────────────────────────
async function applyDeviceAction(parsed, io) {
  const { action, deviceId, target } = parsed;
  const allDevices = target === 'all';

  let devices = [];
  if (allDevices) {
    devices = await ESP32Device.find({});
  } else if (deviceId) {
    const d = await ESP32Device.findOne({ deviceId });
    if (!d) return { success: false, message: `Device "${deviceId}" not found.` };
    devices = [d];
  } else {
    return {
      success: false,
      message: 'Please specify a device name (e.g. "ESP32-A101") or say "all devices".',
    };
  }

  if (!devices.length) {
    return { success: false, message: 'No devices found to control.' };
  }

  const results = [];
  for (const device of devices) {
    if (action === 'device_on') {
      device.monitoringStatus = 'active';
      await device.save();
      if (io) {
        io.emit('deviceUpdate', {
          deviceId: device._id,
          monitoringStatus: 'active',
          jammerStatus: device.jammerStatus,
        });
      }
      results.push(`${device.deviceId} turned ON`);
    } else if (action === 'device_off') {
      device.monitoringStatus = 'inactive';
      device.jammerStatus = 'inactive';
      await device.save();
      if (io) {
        io.emit('deviceUpdate', {
          deviceId: device._id,
          monitoringStatus: 'inactive',
          jammerStatus: 'inactive',
        });
      }
      results.push(`${device.deviceId} turned OFF`);
    } else if (action === 'jammer_on') {
      device.jammerStatus = 'active';
      await device.save();
      if (io) {
        io.emit('jammerUpdate', { deviceId: device._id, jammerStatus: 'active' });
      }
      results.push(`Jammer ON for ${device.deviceId}`);
    } else if (action === 'jammer_off') {
      device.jammerStatus = 'inactive';
      await device.save();
      if (io) {
        io.emit('jammerUpdate', { deviceId: device._id, jammerStatus: 'inactive' });
      }
      results.push(`Jammer OFF for ${device.deviceId}`);
    } else if (action === 'monitoring_on') {
      device.monitoringStatus = 'active';
      await device.save();
      if (io) {
        io.emit('deviceUpdate', {
          deviceId: device._id,
          monitoringStatus: 'active',
          jammerStatus: device.jammerStatus,
        });
      }
      results.push(`Monitoring ON for ${device.deviceId}`);
    } else if (action === 'monitoring_off') {
      device.monitoringStatus = 'inactive';
      device.jammerStatus = 'inactive';
      await device.save();
      if (io) {
        io.emit('deviceUpdate', {
          deviceId: device._id,
          monitoringStatus: 'inactive',
          jammerStatus: 'inactive',
        });
      }
      results.push(`Monitoring OFF for ${device.deviceId}`);
    }
  }

  return { success: true, message: results.join(', ') + '.' };
}

// ─── INFRASTRUCTURE HELPER ────────────────────────────────────────────────
async function handleInfrastructureCreate(parsed, io) {
  const { action, blockName, floorName, roomName, parentBlockName, parentFloorName } = parsed;

  if (action === 'add_block') {
    if (!blockName) return { success: false, message: 'Please specify a block name.' };
    const existing = await Block.findOne({ blockName: { $regex: new RegExp(`^${blockName}$`, 'i') } });
    if (existing) return { success: false, message: `Block "${blockName}" already exists.` };
    const block = await Block.create({ blockName });
    if (io) io.emit('infrastructureUpdate', { type: 'block', action: 'create', data: block });
    return { success: true, message: `Block "${block.blockName}" created successfully.`, route: '/infrastructure' };
  }

  if (action === 'add_floor') {
    if (!floorName) return { success: false, message: 'Please specify a floor name.' };

    let blockId = null;
    if (parentBlockName) {
      const block = await Block.findOne({ blockName: { $regex: new RegExp(parentBlockName, 'i') } });
      if (!block) return { success: false, message: `Block "${parentBlockName}" not found. Create the block first.` };
      blockId = block._id;
    } else {
      // Use most recently created block
      const latestBlock = await Block.findOne().sort({ createdAt: -1 });
      if (!latestBlock) return { success: false, message: 'No blocks exist yet. Please create a block first.' };
      blockId = latestBlock._id;
    }

    const floor = await Floor.create({ floorName, blockId });
    await floor.populate('blockId', 'blockName');
    if (io) io.emit('infrastructureUpdate', { type: 'floor', action: 'create', data: floor });
    return {
      success: true,
      message: `Floor "${floor.floorName}" added to block "${floor.blockId.blockName}".`,
      route: '/infrastructure',
    };
  }

  if (action === 'add_classroom') {
    if (!roomName) return { success: false, message: 'Please specify a room name.' };

    let floorId = null;
    let blockId = null;

    if (parentFloorName) {
      const floor = await Floor.findOne({ floorName: { $regex: new RegExp(parentFloorName, 'i') } }).populate(
        'blockId'
      );
      if (!floor)
        return {
          success: false,
          message: `Floor "${parentFloorName}" not found. Create the floor first.`,
        };
      floorId = floor._id;
      blockId = floor.blockId?._id;
    } else {
      // Use most recently created floor
      const latestFloor = await Floor.findOne().sort({ createdAt: -1 }).populate('blockId');
      if (!latestFloor) return { success: false, message: 'No floors exist yet. Please create a floor first.' };
      floorId = latestFloor._id;
      blockId = latestFloor.blockId?._id;
    }

    if (!blockId) return { success: false, message: 'Could not determine block for this floor.' };

    const room = await Classroom.create({ roomName, floorId, blockId });
    await room.populate(['blockId', 'floorId']);
    if (io) io.emit('infrastructureUpdate', { type: 'classroom', action: 'create', data: room });
    return {
      success: true,
      message: `Classroom "${room.roomName}" created successfully.`,
      route: '/infrastructure',
    };
  }

  if (action === 'delete_block') {
    if (!blockName) return { success: false, message: 'Please specify the block name to delete.' };
    const block = await Block.findOne({ blockName: { $regex: new RegExp(`^${blockName}$`, 'i') } });
    if (!block) return { success: false, message: `Block "${blockName}" not found.` };
    await Block.findByIdAndDelete(block._id);
    if (io) io.emit('infrastructureUpdate', { type: 'block', action: 'delete', data: block });
    return { success: true, message: `Block "${block.blockName}" has been deleted.`, route: '/infrastructure' };
  }

  if (action === 'delete_floor') {
    if (!floorName) return { success: false, message: 'Please specify the floor name to delete.' };
    const floor = await Floor.findOne({ floorName: { $regex: new RegExp(`^${floorName}$`, 'i') } });
    if (!floor) return { success: false, message: `Floor "${floorName}" not found.` };
    await Floor.findByIdAndDelete(floor._id);
    if (io) io.emit('infrastructureUpdate', { type: 'floor', action: 'delete', data: floor });
    return { success: true, message: `Floor "${floor.floorName}" has been deleted.`, route: '/infrastructure' };
  }

  if (action === 'delete_classroom') {
    if (!roomName) return { success: false, message: 'Please specify the room name to delete.' };
    const room = await Classroom.findOne({ roomName: { $regex: new RegExp(`^${roomName}$`, 'i') } });
    if (!room) return { success: false, message: `Classroom "${roomName}" not found.` };
    await Classroom.findByIdAndDelete(room._id);
    if (io) io.emit('infrastructureUpdate', { type: 'classroom', action: 'delete', data: room });
    return { success: true, message: `Classroom "${room.roomName}" has been deleted.`, route: '/infrastructure' };
  }

  return { success: false, message: 'Unknown infrastructure action.' };
}

// ─── ANALYTICS HELPER ─────────────────────────────────────────────────────
async function handleConversationalAnalytics(parsed) {
  if (parsed.action === 'analytics_online_devices') {
    const cutoff = new Date(Date.now() - 60000); // 1 minute ago
    const count = await ESP32Device.countDocuments({ lastSeen: { $gte: cutoff }, status: 'online' });
    return { success: true, message: `There are currently ${count} devices online.` };
  }

  if (parsed.action === 'analytics_nearest_devices') {
    const cutoff = new Date(Date.now() - 5 * 60000); // last 5 mins
    const count = await DetectionLog.countDocuments({ timestamp: { $gte: cutoff }, rssi: { $gte: -65 } });
    return { success: true, message: `I found ${count} devices very close to the sensors in the last 5 minutes.` };
  }

  if (parsed.action === 'analytics_total_alerts') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const count = await DetectionLog.countDocuments({ timestamp: { $gte: today } });
    return { success: true, message: `There have been ${count} Bluetooth alerts recorded today.` };
  }

  if (parsed.action === 'analytics_most_active_room') {
    const result = await DetectionLog.aggregate([
      { $match: { classroomId: { $ne: null } } },
      { $group: { _id: '$classroomId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ]);
    
    if (result.length > 0) {
      const room = await Classroom.findById(result[0]._id).populate('blockId');
      if (room) {
        return { success: true, message: `The most active room is ${room.roomName} in ${room.blockId ? room.blockId.blockName : 'an unknown block'}, with ${result[0].count} total alerts.` };
      }
    }
    return { success: true, message: 'Not enough data to determine the most active room.' };
  }

  if (parsed.action === 'analytics_explain_report') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const alertsToday = await DetectionLog.countDocuments({ timestamp: { $gte: today } });
    
    const onlineDevices = await ESP32Device.countDocuments({ status: 'online' });
    const totalDevices = await ESP32Device.countDocuments();
    const jammerActive = await ESP32Device.countDocuments({ jammerStatus: 'active' });

    const topRoomResult = await DetectionLog.aggregate([
      { $match: { classroomId: { $ne: null } } },
      { $group: { _id: '$classroomId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ]);

    let topRoomStr = '';
    if (topRoomResult.length > 0) {
      const room = await Classroom.findById(topRoomResult[0]._id).populate('blockId');
      if (room) {
        topRoomStr = ` The most active area is ${room.roomName} in ${room.blockId ? room.blockId.blockName : 'an unknown block'}.`;
      }
    }

    const message = `Here is your report summary. Out of ${totalDevices} total devices, ${onlineDevices} are currently online, and the jammer is active on ${jammerActive}. Today, we have recorded ${alertsToday} Bluetooth alerts.${topRoomStr}`;
    return { success: true, message, route: '/reports' };
  }

  return { success: false, message: 'Analytics query not recognized.' };
}

// ─── MAIN HANDLER ────────────────────────────────────────────────────────
exports.processVoice = async (req, res, next) => {
  try {
    const { text, confirm, context } = req.body;
    const userId = req.user?.id;
    if (!text) return res.status(400).json({ success: false, message: 'No command text was provided.' });

    const io = req.app.get('io');

    // ── MULTI-TURN CONVERSATION HANDLING ────────────────────────────────
    if (context && context.intent === 'add_user') {
      const lowerText = text.toLowerCase();
      let role = 'examuser'; // default
      if (lowerText.includes('admin')) role = 'admin';
      
      const userName = context.target;
      const email = `${userName.toLowerCase().replace(/\s+/g, '')}@example.com`;
      const existingUser = await User.findOne({ email });
      
      let responseMessage = '';
      if (existingUser) {
        responseMessage = `A user with the email ${email} already exists.`;
      } else {
        await User.create({
          name: userName,
          email,
          password: 'password123',
          role
        });
        responseMessage = `Successfully created ${userName} as ${role === 'admin' ? 'an admin' : 'a supervisor'}. Their email is ${email}.`;
        if (io) io.emit('userUpdate'); 
      }
      
      await VoiceCommand.create({
        text, intent: 'add_user', action: 'add_user', target: userName,
        response: { message: responseMessage }, user: userId
      });

      return res.json({
        success: true, needsConfirmation: false, needsFollowUp: false,
        message: responseMessage, route: '/users',
        parsed: { intent: 'add_user', action: 'add_user', target: userName }
      });
    }

    const parsed = parseIntent(text);

    // Actions that need confirmation before execution
    const requiresConfirmation = [
      'device_off', 'monitoring_off', 'generate_report', 
      'delete_block', 'delete_floor', 'delete_classroom', 'delete_device', 'delete_user',
      'clear_logs'
    ].includes(parsed.action);

    if (requiresConfirmation && !confirm) {
      let actionLabel = 'perform this action';
      if (parsed.action === 'device_off') actionLabel = `turn OFF ${parsed.target === 'all' ? 'all devices' : parsed.deviceId || 'the device'}`;
      if (parsed.action === 'monitoring_off') actionLabel = `disable monitoring${parsed.deviceId ? ' for ' + parsed.deviceId : ''}`;
      if (parsed.action === 'generate_report') actionLabel = 'generate a report';
      if (parsed.action === 'clear_logs') actionLabel = 'permanently delete all detection logs';
      if (parsed.action.startsWith('delete_')) actionLabel = `permanently delete this ${parsed.action.replace('delete_', '')}`;

      await VoiceCommand.create({
        text,
        intent: parsed.intent,
        action: parsed.action,
        target: parsed.target || parsed.deviceId,
        user: userId,
      });

      return res.json({
        success: true,
        needsConfirmation: true,
        message: `Are you sure you want to ${actionLabel}?`,
        parsed,
      });
    }

    let responseMessage = 'Command received.';
    let route = parsed.route || null;

    // ── HANDLE EACH ACTION ─────────────────────────────────────────────────
    if (parsed.action === 'navigate') {
      const labelMap = {
        '/dashboard': 'Dashboard',
        '/infrastructure': 'Infrastructure',
        '/devices': 'ESP32 Devices',
        '/logs': 'Detection Logs',
        '/monitoring': 'Monitoring',
        '/users': 'Users',
        '/reports': 'Reports',
      };
      const label = labelMap[route] || route;
      responseMessage = `Opening ${label}.`;

    } else if (parsed.action === 'logout') {
      responseMessage = 'You have been logged out.';

    } else if (
      ['device_on', 'device_off', 'jammer_on', 'jammer_off', 'monitoring_on', 'monitoring_off'].includes(
        parsed.action
      )
    ) {
      const result = await applyDeviceAction(parsed, io);
      responseMessage = result.message;
      if (!result.success) {
        await VoiceCommand.create({ text, intent: parsed.intent, action: parsed.action, target: parsed.target || parsed.deviceId, response: { message: responseMessage }, user: userId });
        return res.json({ success: false, needsConfirmation: false, message: responseMessage, parsed });
      }

    } else if (['add_block', 'add_floor', 'add_classroom', 'delete_block', 'delete_floor', 'delete_classroom'].includes(parsed.action)) {
      const result = await handleInfrastructureCreate(parsed, io);
      responseMessage = result.message;
      if (result.route) route = result.route;
      if (!result.success) {
        await VoiceCommand.create({ text, intent: parsed.intent, action: parsed.action, target: null, response: { message: responseMessage }, user: userId });
        return res.json({ success: false, needsConfirmation: false, message: responseMessage, parsed });
      }

    } else if (parsed.action === 'add_user') {
      // Start multi-turn flow
      return res.json({
        success: true,
        needsFollowUp: true,
        message: `Should ${parsed.target} be an admin or a supervisor?`,
        context: {
          intent: 'add_user',
          target: parsed.target
        },
        parsed
      });

    } else if (parsed.action === 'delete_device') {
      const d = await ESP32Device.findOne({ deviceId: parsed.deviceId });
      if (d) {
        await ESP32Device.findByIdAndDelete(d._id);
        responseMessage = `Device ${parsed.deviceId} has been deleted.`;
        if (io) io.emit('deviceUpdate', { action: 'delete', deviceId: d._id });
      } else {
        responseMessage = `Could not find device ${parsed.deviceId} to delete.`;
      }
      route = '/devices';

    } else if (parsed.action === 'delete_user') {
      const u = await User.findOne({ name: { $regex: new RegExp(`^${parsed.target}$`, 'i') } });
      if (u) {
        await User.findByIdAndDelete(u._id);
        responseMessage = `User ${parsed.target} has been permanently deleted.`;
        if (io) io.emit('userUpdate');
      } else {
        responseMessage = `Could not find a user named ${parsed.target}.`;
      }
      route = '/users';

    } else if (parsed.action === 'clear_logs') {
      await DetectionLog.deleteMany({});
      responseMessage = 'All detection logs have been permanently wiped.';
      if (io) io.emit('logsCleared'); // Frontend will listen for this to refresh the page
      route = '/logs';

    } else if (parsed.action === 'export_logs') {
      responseMessage = 'Exporting detection logs as CSV now.';
      if (io) io.emit('triggerExport'); // Frontend will listen for this to trigger download
      route = '/logs';

    } else if (parsed.action.startsWith('analytics_')) {
      const result = await handleConversationalAnalytics(parsed);
      responseMessage = result.message;

    } else if (parsed.action === 'find_nearest') {
      if (parsed.macAddress) {
        const nearest = await DetectionLog.findOne({ macAddress: parsed.macAddress })
          .sort({ rssi: -1 })
          .populate('esp32DeviceId');
        if (nearest && nearest.esp32DeviceId) {
          responseMessage = `Nearest device for that MAC is ${nearest.esp32DeviceId.deviceId}.`;
        } else {
          responseMessage = 'No recent detection found for that MAC address.';
        }
      } else {
        responseMessage = 'Please provide a MAC address to locate the nearest device.';
      }

    } else if (parsed.action === 'search_student') {
      responseMessage = parsed.target ? `Searching for student "${parsed.target}".` : 'Please specify a student to search for.';

    } else if (parsed.intent === 'wake') {
      responseMessage = 'Yes, I am listening. How can I help?';

    } else {
      responseMessage = "I didn't understand that command.";
    }

    await VoiceCommand.create({
      text,
      intent: parsed.intent,
      action: parsed.action,
      target: parsed.target || parsed.deviceId || parsed.blockName || parsed.floorName || parsed.roomName,
      response: { message: responseMessage },
      user: userId,
    });

    return res.json({
      success: true,
      needsConfirmation: false,
      message: responseMessage,
      route,
      parsed,
    });
  } catch (err) {
    console.error('[VoiceController] Error:', err);
    next(err);
  }
};

exports.history = async (req, res, next) => {
  try {
    const items = await VoiceCommand.find().sort({ createdAt: -1 }).limit(50).populate('user', 'name email');
    res.json({ success: true, items });
  } catch (err) {
    next(err);
  }
};
