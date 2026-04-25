const { Pool } = require('pg');
require('dotenv').config(); // Esto lee tu archivo .env

// Creamos un "Pool" de conexiones (permite múltiples conexiones simultáneas)
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Probamos la conexión al iniciar
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error conectando a PostgreSQL:', err.stack);
  } else {
    console.log('✅ Conexión exitosa a la base de datos PostgreSQL');
  }
  if (client) release();
});

module.exports = pool;