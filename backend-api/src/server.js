require('dotenv').config({ path: 'DB.env' });
const express = require('express');
const cors = require('cors');
const pool = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/api', productRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', orderRoutes);

app.get('/', (req, res) => {
  res.send('Servidor funcionando');
});

async function startServer() {
  try {
    await pool.query('SELECT 1');
    console.log('Conexion a PostgreSQL exitosa');

    app.listen(PORT, () => {
      console.log(`Servidor corriendo en puerto ${PORT}`);
    });
  } catch (error) {
    console.error('No se pudo conectar a PostgreSQL:', error.message);
  }
}

startServer();
