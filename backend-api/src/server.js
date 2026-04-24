require('dotenv').config({ path: 'DB.env' });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');

const pool = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const billingRoutes = require('./routes/billingRoutes');
const initializeSocket = require('./sockets/socketMain');

const app = express();
const server = http.createServer(app);
const io = initializeSocket(server);
const PORT = process.env.PORT || 3000;

app.set('io', io);

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api', productRoutes);
app.use('/api', orderRoutes);
app.use('/api', billingRoutes);

app.get('/', (req, res) => {
  res.send('Servidor funcionando');
});

async function startServer() {
  try {
    await pool.query('SELECT 1');
    console.log('Conexion a PostgreSQL exitosa');

    server.listen(PORT, () => {
      console.log(`Servidor corriendo en puerto ${PORT}`);
    });
  } catch (error) {
    console.error('No se pudo conectar a PostgreSQL:', error.message);
  }
}

startServer();
