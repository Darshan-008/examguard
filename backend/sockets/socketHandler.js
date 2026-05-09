const ESP32Device = require('../models/ESP32Device');

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    socket.on('joinRoom', (roomId) => {
      socket.join(roomId);
      console.log(`[Socket] ${socket.id} joined room: ${roomId}`);
    });

    socket.on('leaveRoom', (roomId) => {
      socket.leave(roomId);
    });

    // ESP32 device coming online via socket
    socket.on('deviceOnline', async ({ deviceId }) => {
      try {
        const device = await ESP32Device.findOneAndUpdate(
          { deviceId },
          { status: 'online', lastSeen: new Date() },
          { returnDocument: 'after' }
        );
        if (device) {
          io.emit('deviceStatus', { deviceId: device._id, deviceStringId: deviceId, status: 'online' });
        }
      } catch (err) {
        console.error('[Socket] deviceOnline error:', err.message);
      }
    });

    // Admin manually clears alert for a classroom
    socket.on('clearAlert', ({ classroomId }) => {
      const Classroom = require('../models/Classroom');
      Classroom.findByIdAndUpdate(classroomId, { alertStatus: false }).exec();
      io.emit('alertCleared', { classroomId });
    });

    socket.on('disconnect', async () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });

  // Mark devices offline every 60 seconds if no heartbeat
  setInterval(async () => {
    try {
      const threshold = new Date(Date.now() - 90000); // 90s
      const result = await ESP32Device.updateMany(
        { status: 'online', lastSeen: { $lt: threshold } },
        { status: 'offline' }
      );
      if (result.modifiedCount > 0) {
        io.emit('devicesOffline', { count: result.modifiedCount });
      }
    } catch (err) {
      console.error('[Socket] Offline check error:', err.message);
    }
  }, 60000);
};
