const { Server } = require('socket.io');
const registerSocketHandlers = require('./handlers');

const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    registerSocketHandlers(io, socket);
  });

  return io;
};

module.exports = initializeSocket;
