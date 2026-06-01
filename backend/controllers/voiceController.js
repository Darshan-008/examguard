const VoiceCommand = require('../models/VoiceCommand');
const ESP32Device = require('../models/ESP32Device');
const DetectionLog = require('../models/DetectionLog');

const macRegex = /([0-9A-Fa-f]{2}(?::|-)?){5}[0-9A-Fa-f]{2}/;
const esp32Regex = /\b(ESP32[-_ ]?[A-Z0-9]+)\b/i;
const deviceNameRegex = /\bdevice\s+([A-Z0-9-]+)\b/i;

function normalizeDeviceId(value) {
  if (!value) return null;
  const normalized = value.toUpperCase().replace(/[_ ]+/g, '-');
  return normalized.startsWith('ESP32') ? normalized : `ESP32-${normalized}`;
}

function parseIntent(text) {
  const original = text.trim();
  const lower = original.toLowerCase();
  const deviceMatch = esp32Regex.exec(original) || deviceNameRegex.exec(original);
  const deviceId = normalizeDeviceId(deviceMatch ? deviceMatch[1] : null);
  const macMatch = macRegex.exec(original);
  const targetAll = /\ball\b/.test(lower) || /all devices/.test(lower) || /every device/.test(lower);

  const parsed = {
    intent: 'unknown',
    action: 'unknown',
    route: null,
    deviceId: deviceId || null,
    macAddress: macMatch ? macMatch[0].replace(/-/g, ':').toUpperCase() : null,
    target: targetAll ? 'all' : null,
    raw: original,
  };

  if (/\b(hey\s+examguard|examguard)\b/.test(lower)) {
    parsed.intent = 'wake';
  }

  if (/(?:navigate to|go to|open|show|view)\b.*\b(dashboard|infrastructure|devices|esp32|logs|alerts|detection|monitoring|reports|users)\b/.test(lower)
      || (/\b(dashboard|infrastructure|devices|esp32|logs|alerts|detection|monitoring|reports|users)\b/.test(lower) && !/(?:stop|disable|turn off|power off|hide|close)\b/.test(lower))) {
    parsed.intent = 'navigate';
    if (/dashboard/.test(lower)) parsed.route = '/dashboard';
    else if (/infrastructure/.test(lower)) parsed.route = '/infrastructure';
    else if (/(?:devices|esp32)\b/.test(lower)) parsed.route = '/devices';
    else if (/(?:monitoring|monitor)\b/.test(lower)) parsed.route = '/monitoring';
    else if (/(?:logs|alerts|detection)\b/.test(lower)) parsed.route = '/logs';
    else if (/users\b/.test(lower)) parsed.route = '/users';
    else if (/reports\b/.test(lower) || /analytics|statistics/.test(lower)) parsed.route = '/reports';
    parsed.action = parsed.route ? 'navigate' : 'unknown';
    return parsed;
  }

  if (/(?:show|view|list).*(?:device|devices|esp32)/.test(lower)) {
    parsed.intent = 'show_devices';
    parsed.action = 'show_devices';
    parsed.route = '/devices';
    return parsed;
  }

  if (/(show|view).*(alert|alerts)/.test(lower)) {
    parsed.intent = 'view_alerts';
    parsed.action = 'view_alerts';
    parsed.route = '/logs';
    return parsed;
  }

  if (/(show|view).*(report|analytics|statistics)/.test(lower)) {
    parsed.intent = 'view_reports';
    parsed.action = 'view_reports';
    parsed.route = '/reports';
    return parsed;
  }

  if (/search.*student/.test(lower) || /find.*student/.test(lower)) {
    parsed.intent = 'search_student';
    parsed.action = 'search_student';
    const query = lower.replace(/search|find|student|for|me|the|a/g, '').trim();
    parsed.target = query || null;
    return parsed;
  }

  if (/(locate|find).*(nearest|closest).*device/.test(lower) || /find.*nearest.*device/.test(lower)) {
    parsed.intent = 'find_nearest';
    parsed.action = 'find_nearest';
    return parsed;
  }

  if (/(?:turn on|start|enable)\b.*\bmonitor(?:ing)?\b/.test(lower) || /monitoring\s+on/.test(lower)) {
    parsed.intent = 'start_monitoring';
    parsed.action = 'start';
    return parsed;
  }

  if (/(?:turn off|stop|disable|power off)\b.*\bmonitor(?:ing)?\b/.test(lower) || /monitoring\s+off/.test(lower)) {
    parsed.intent = 'stop_monitoring';
    parsed.action = 'stop';
    return parsed;
  }

  if (/(?:turn on|start|enable)\b.*\b(device|esp32)\b/.test(lower) || /power on\b.*\b(device|esp32)\b/.test(lower)) {
    parsed.intent = 'start_device';
    parsed.action = 'start';
    return parsed;
  }

  if (/(?:turn off|stop|disable|power off)\b.*\b(device|esp32)\b/.test(lower)) {
    parsed.intent = 'stop_device';
    parsed.action = 'stop';
    return parsed;
  }

  if (/(?:turn on|enable|activate)\b.*\bjammer\b/.test(lower)) {
    parsed.intent = 'toggle_jammer';
    parsed.action = 'toggle_jammer';
    return parsed;
  }

  if (/(?:turn off|disable|deactivate)\b.*\bjammer\b/.test(lower)) {
    parsed.intent = 'toggle_jammer';
    parsed.action = 'toggle_jammer';
    return parsed;
  }

  if (/(toggle|switch).*(monitoring)/.test(lower) && !/jammer/.test(lower)) {
    parsed.intent = 'toggle_monitoring';
    parsed.action = 'toggle_monitoring';
    return parsed;
  }

  if (/(generate|create|show).*(report|analytics)/.test(lower)) {
    parsed.intent = 'generate_report';
    parsed.action = 'generate_report';
    return parsed;
  }

  if (/\b(locat(e|ing)|find).*\b/.test(lower) && /device/.test(lower)) {
    parsed.intent = 'locate';
    parsed.action = 'locate';
    return parsed;
  }

  return parsed;
}

async function queueDeviceCommand(parsed) {
  if (!parsed.action || parsed.action === 'unknown') {
    return { message: "I couldn't turn that into a device command." };
  }

  const targetDeviceId = parsed.deviceId;
  const allDevices = parsed.target === 'all';
  let command = { action: parsed.action };
  if (parsed.macAddress) command.macAddress = parsed.macAddress;

  if (parsed.action === 'find_nearest' && parsed.macAddress) {
    const nearest = await DetectionLog.findOne({ macAddress: parsed.macAddress }).sort({ rssi: -1 }).populate('esp32DeviceId');
    if (!nearest || !nearest.esp32DeviceId) {
      return { message: 'I could not find a recent detection for that MAC address.' };
    }
    const device = await ESP32Device.findById(nearest.esp32DeviceId._id);
    if (!device) return { message: 'The nearest device record is missing.' };
    if (device.status !== 'online') return { message: `Device ${device.deviceId} is currently offline.` };
    device.pendingCommand = { type: 'locate', macAddress: parsed.macAddress };
    await device.save();
    return { message: `Queued locate command for nearest device ${device.deviceId}.` };
  }

  if (targetDeviceId) {
    const device = await ESP32Device.findOne({ deviceId: targetDeviceId });
    if (!device) return { message: `I couldn't find device ${targetDeviceId}.` };
    if (device.status !== 'online') return { message: `Device ${device.deviceId} is offline.` };
    device.pendingCommand = command;
    await device.save();
    return { message: `Queued ${parsed.action.replace('_', ' ')} command for ${device.deviceId}.` };
  }

  if (allDevices) {
    await ESP32Device.updateMany({}, { pendingCommand: command });
    return { message: `Queued ${parsed.action.replace('_', ' ')} command for all devices.` };
  }

  return { message: 'Please specify a device or say all devices for this command.' };
}

exports.processVoice = async (req, res, next) => {
  try {
    const { text, confirm } = req.body;
    const userId = req.user?.id;
    if (!text) return res.status(400).json({ success: false, message: 'No command text was provided.' });

    const parsed = parseIntent(text);
    const requiresConfirmation = ['stop', 'stop_monitoring', 'stop_device', 'generate_report'].includes(parsed.action);

    if (requiresConfirmation && !confirm) {
      const command = await VoiceCommand.create({ text, intent: parsed.intent, action: parsed.action, target: parsed.target, user: userId });
      return res.json({
        success: true,
        needsConfirmation: true,
        message: `Are you sure you want to ${parsed.action.replace('_', ' ')}?`,
        commandId: command._id,
        parsed,
      });
    }

    let responseMessage = 'Command received.';
    let route = parsed.route || null;
    let commandResult = null;

    if (parsed.action === 'navigate' && route) {
      responseMessage = `Navigating to ${route}.`;
    } else if (parsed.action === 'show_devices') {
      responseMessage = 'Opening devices page.';
      route = '/devices';
    } else if (parsed.action === 'view_alerts') {
      responseMessage = 'Showing alerts and detections.';
      route = '/logs';
    } else if (parsed.action === 'view_reports') {
      responseMessage = 'Opening reports and analytics.';
      route = '/reports';
    } else if (parsed.action === 'search_student') {
      responseMessage = parsed.target ? `Searching for student ${parsed.target}.` : 'Searching for students.';
    } else if (['locate', 'find_nearest', 'start', 'stop', 'toggle_jammer', 'toggle_monitoring'].includes(parsed.action)) {
      commandResult = await queueDeviceCommand(parsed);
      responseMessage = commandResult.message;
    } else if (parsed.action === 'generate_report') {
      responseMessage = 'Generating the requested report. Please check the Reports page.';
      route = '/reports';
    } else if (parsed.intent === 'unknown') {
      responseMessage = "I didn't understand that command. Please try again.";
    }

    const saved = await VoiceCommand.create({
      text,
      intent: parsed.intent,
      action: parsed.action,
      target: parsed.target,
      response: { message: responseMessage },
      user: userId,
    });

    const io = req.app.get('io');
    if (io && commandResult) {
      io.emit('voiceAction', { success: true, action: parsed.action, text, parsed, message: responseMessage });
    }

    return res.json({
      success: true,
      needsConfirmation: false,
      message: responseMessage,
      route,
      parsed,
      command: saved,
    });
  } catch (err) {
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
