const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Models
const User = require('../models/User');
const Block = require('../models/Block');
const Floor = require('../models/Floor');
const Classroom = require('../models/Classroom');
const ESP32Device = require('../models/ESP32Device');
const DetectionLog = require('../models/DetectionLog');

dotenv.config({ path: path.join(__dirname, '../.env') });

const clearData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('[Cleanup] Connected to MongoDB');

    // 1. Clear Infrastructure
    console.log('[Cleanup] Removing Blocks, Floors, Classrooms...');
    await Block.deleteMany({});
    await Floor.deleteMany({});
    await Classroom.deleteMany({});

    // 2. Clear Devices & Logs
    console.log('[Cleanup] Removing Devices and Detection Logs...');
    await ESP32Device.deleteMany({});
    await DetectionLog.deleteMany({});

    // 3. Clear Users except the primary admin
    console.log('[Cleanup] Cleaning Users (keeping primary admin)...');
    await User.deleteMany({ email: { $ne: 'admin@btmonitor.com' } });

    console.log('\n✅ Database cleared successfully!');
    console.log('Only the primary admin (admin@btmonitor.com) remains.');
    console.log('You can now start adding your real campus infrastructure.');
    
    process.exit(0);
  } catch (error) {
    console.error('[Cleanup] Error:', error.message);
    process.exit(1);
  }
};

clearData();
