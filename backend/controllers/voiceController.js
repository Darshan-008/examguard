const VoiceCommand = require('../models/VoiceCommand');
const ESP32Device = require('../models/ESP32Device');
const DetectionLog = require('../models/DetectionLog');
const Block = require('../models/Block');
const Floor = require('../models/Floor');
const Classroom = require('../models/Classroom');

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
  const hasActionKeywords = /\b(on|off|enable|disable|start|stop|add|create|new|register|turn|toggle|jammer)\b/.test(lower);

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

  // ── SEARCH STUDENT ────────────────────────────────────────────────────────
  if (/search.*student/.test(lower) || /find.*student/.test(lower)) {
    parsed.intent = 'search_student';
    parsed.action = 'search_student';
    const query = lower.replace(/search|find|student|for|me|the|a/g, '').trim();
    parsed.target = query || null;
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

  return { success: false, message: 'Unknown infrastructure action.' };
}

// ─── MAIN HANDLER ────────────────────────────────────────────────────────
exports.processVoice = async (req, res, next) => {
  try {
    const { text, confirm } = req.body;
    const userId = req.user?.id;
    if (!text) return res.status(400).json({ success: false, message: 'No command text was provided.' });

    const parsed = parseIntent(text);
    const io = req.app.get('io');

    // Actions that need confirmation before execution
    const requiresConfirmation = ['device_off', 'monitoring_off', 'generate_report'].includes(parsed.action);

    if (requiresConfirmation && !confirm) {
      const actionLabel =
        parsed.action === 'device_off'
          ? `turn OFF ${parsed.target === 'all' ? 'all devices' : parsed.deviceId || 'the device'}`
          : parsed.action === 'monitoring_off'
          ? `disable monitoring${parsed.deviceId ? ' for ' + parsed.deviceId : ''}`
          : 'generate a report';

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

    } else if (['add_block', 'add_floor', 'add_classroom'].includes(parsed.action)) {
      const result = await handleInfrastructureCreate(parsed, io);
      responseMessage = result.message;
      if (result.route) route = result.route;
      if (!result.success) {
        await VoiceCommand.create({ text, intent: parsed.intent, action: parsed.action, target: null, response: { message: responseMessage }, user: userId });
        return res.json({ success: false, needsConfirmation: false, message: responseMessage, parsed });
      }

    } else if (parsed.action === 'generate_report') {
      responseMessage = 'Generating the requested report. Please check the Reports page.';
      route = '/reports';

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
