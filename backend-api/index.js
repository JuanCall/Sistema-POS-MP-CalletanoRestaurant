require('dotenv').config();
const express = require('express');
const pool = require('./db'); // IMPORTANTE

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// 🔥 PRUEBA DE CONEXIÓN A POSTGRESQL
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Error conectando a PostgreSQL:', err);
  } else {
    console.log('Conectado a PostgreSQL:', res.rows);
  }
});

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('Servidor funcionando 🚀');
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});