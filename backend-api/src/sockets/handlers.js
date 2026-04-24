const registerSocketHandlers = (io, socket) => {
  console.log(`Cliente conectado: ${socket.id}`);

  // Envia informacion inicial para que el cliente pueda resincronizarse
  socket.emit('socket-bienvenido', {
    socketId: socket.id,
    message: 'Conexion establecida correctamente',
  });

  socket.on('disconnect', (reason) => {
    console.log(`Cliente desconectado: ${socket.id}. Motivo: ${reason}`);
  });

  socket.on('error', (error) => {
    console.error(`Error en socket ${socket.id}:`, error.message);
  });
};

module.exports = registerSocketHandlers;
