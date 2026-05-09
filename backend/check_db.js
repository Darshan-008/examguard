const mongoose = require('mongoose');
require('dotenv').config();

const ESP32Device = require('./models/ESP32Device');
const Classroom = require('./models/Classroom');
const DetectionLog = require('./models/DetectionLog');

async function checkDb() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const devices = await ESP32Device.find();
    console.log('\n--- DEVICES ---');
    devices.forEach(d => {
      console.log(`ID: ${d.deviceId}, MongoID: ${d._id}, Status: ${d.status}, Classroom: ${d.classroomId}`);
    });

    const logs = await DetectionLog.find();
    console.log('\n--- DETECTION LOGS ---');
    console.log(`Total Logs: ${logs.length}`);
    logs.slice(0, 5).forEach(l => {
      console.log(`Time: ${l.timestamp}, MAC: ${l.macAddress}, RSSI: ${l.rssi}`);
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkDb();
