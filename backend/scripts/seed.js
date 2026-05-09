require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Block = require('../models/Block');
const Floor = require('../models/Floor');
const Classroom = require('../models/Classroom');
const ESP32Device = require('../models/ESP32Device');

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('[Seed] Connected to MongoDB');

  // Clear existing
  await Promise.all([
    User.deleteMany(),
    Block.deleteMany(),
    Floor.deleteMany(),
    Classroom.deleteMany(),
    ESP32Device.deleteMany(),
  ]);

  // Create admin
  const admin = await User.create({
    name: 'Admin User',
    email: 'admin@btmonitor.com',
    password: 'admin123',
    role: 'admin',
  });

  // Create exam user
  await User.create({
    name: 'Exam Supervisor',
    email: 'supervisor@btmonitor.com',
    password: 'exam1234',
    role: 'examuser',
  });

  // Blocks
  const blockA = await Block.create({ blockName: 'Block A' });
  const blockB = await Block.create({ blockName: 'Block B' });

  // Floors
  const floor1A = await Floor.create({ floorName: 'Floor 1', blockId: blockA._id });
  const floor2A = await Floor.create({ floorName: 'Floor 2', blockId: blockA._id });
  const floor1B = await Floor.create({ floorName: 'Floor 1', blockId: blockB._id });

  // ESP32 Devices
  const dev1 = await ESP32Device.create({ deviceId: 'ESP32-A101', ipAddress: '192.168.1.101', status: 'online', lastSeen: new Date() });
  const dev2 = await ESP32Device.create({ deviceId: 'ESP32-A102', ipAddress: '192.168.1.102', status: 'offline' });
  const dev3 = await ESP32Device.create({ deviceId: 'ESP32-B101', ipAddress: '192.168.1.103', status: 'online', lastSeen: new Date() });

  // Classrooms
  const room101 = await Classroom.create({ roomName: 'Room 101', blockId: blockA._id, floorId: floor1A._id, esp32DeviceId: dev1._id });
  const room102 = await Classroom.create({ roomName: 'Room 102', blockId: blockA._id, floorId: floor1A._id, esp32DeviceId: dev2._id });
  const room201 = await Classroom.create({ roomName: 'Room 201', blockId: blockA._id, floorId: floor2A._id });
  const roomB101 = await Classroom.create({ roomName: 'Room B101', blockId: blockB._id, floorId: floor1B._id, esp32DeviceId: dev3._id });

  // Link devices to classrooms
  await ESP32Device.findByIdAndUpdate(dev1._id, { classroomId: room101._id });
  await ESP32Device.findByIdAndUpdate(dev2._id, { classroomId: room102._id });
  await ESP32Device.findByIdAndUpdate(dev3._id, { classroomId: roomB101._id });

  console.log('[Seed] ✅ Database seeded successfully!');
  console.log('[Seed] Admin: admin@btmonitor.com / admin123');
  console.log('[Seed] Supervisor: supervisor@btmonitor.com / exam1234');
  process.exit(0);
};

seed().catch((err) => { console.error('[Seed] Error:', err); process.exit(1); });
