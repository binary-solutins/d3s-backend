const { Server } = require('socket.io');

let io;
const userSockets = new Map(); // userId -> socketId

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*", // Adjust this in production to match your frontend URL
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    console.log('🔌 New client connected:', socket.id);

    // Join room based on userId and userType
    socket.on('join', (data) => {
      const { userId, userType } = data;
      if (userId && userType) {
        const roomName = `${userType}_${userId}`;
        socket.join(roomName);
        console.log(`👤 User ${userId} (${userType}) joined room: ${roomName}`);
        userSockets.set(`${userType}_${userId}`, socket.id);
      }
    });

    socket.on('disconnect', () => {
      console.log('❌ Client disconnected:', socket.id);
      // Clean up mapping if necessary
    });
  });

  return io;
};

const sendRealTimeNotification = (userId, userType, notificationData) => {
  if (io) {
    const roomName = `${userType}_${userId}`;
    io.to(roomName).emit('new_notification', notificationData);
    console.log(`📡 Real-time notification sent to ${roomName}`);
  }
};

module.exports = { initSocket, sendRealTimeNotification };
