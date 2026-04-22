// src/services/socket.js
import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Reemplazar los X con la IP local de la computadora que hará de servidor (Backend)
const SERVER_URL = 'http://192.168.18.32:3000'; 

class SocketService {
  constructor() {
    this.socket = null;
  }

  async conectar() {
    if (!this.socket) {
      try {
        let ipGuardada = await AsyncStorage.getItem('@server_ip');
        // Si no hay IP guardada, usamos una de respaldo o localhost para evitar que colapse
        let urlServidor = ipGuardada ? `http://${ipGuardada}:3000` : 'http://localhost:3000';

        this.socket = io(urlServidor, {
          transports: ['websocket'],
          autoConnect: true,
        });

        this.socket.on('connect', () => {
          console.log('✅ Conectado al servidor POS en:', urlServidor);
        });

        this.socket.on('disconnect', (reason) => {
          console.warn('❌ Desconectado del servidor:', reason);
        });
      } catch (error) {
        console.error('Error leyendo IP:', error);
      }
    }
  }

  desconectar() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Función para disparar el pedido a la cocina/caja
  enviarPedido(mesa, items, total) {
    if (this.socket && this.socket.connected) {
      const payload = {
        mesa: mesa,
        items: items,
        total: total,
        timestamp: new Date().toISOString()
      };
      
      this.socket.emit('nuevo-pedido', payload);
      return true;
    } else {
      console.error('No hay conexión con el servidor. El pedido no se pudo enviar.');
      return false;
    }
  }
}

export const socketService = new SocketService();