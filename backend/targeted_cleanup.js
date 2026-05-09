const mongoose = require('mongoose');
require('dotenv').config();

const ESP32Device = require('./models/ESP32Device');
const Classroom = require('./models/Classroom');
const DetectionLog = require('./models/DetectionLog');

async function cleanup() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB for cleanup');

    // 1. Clear all detection logs
    await DetectionLog.deleteMany({});
    console.log('Detection logs cleared.');

    // 2. Remove all devices EXCEPT ESP32-A101 (the one user is using)
    const result = await ESP32Device.deleteMany({ deviceId: { $ne: 'ESP32-A101' } });
    console.log(`Deleted ${result.deletedCount} demo devices.`);

    // 3. Reset all classroom statuses
    await Classroom.updateMany({}, {
      alertStatus: false,
      totalDetections: 0,
      lastDetectionTime: null
    });
    console.log('Classroom statuses reset to Safe.');

    console.log('Cleanup complete!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

cleanup();
