const express = require('express');
const pool = require('../config/database');
const { logError } = require('../utils/logger');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: 'Email y password son obligatorios',
    });
  }

  try {
    const result = await pool.query(
      `SELECT id_usuario, nombre, email, rol
       FROM usuarios
       WHERE email = $1 AND password = $2`,
      [email, password]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        message: 'Credenciales invalidas',
      });
    }

    return res.status(200).json({
      message: 'Login exitoso',
      usuario: result.rows[0],
    });
  } catch (error) {
    console.error('Error en login:', error.message);

    logError({
      message: 'Error en login',
      error,
      context: 'authRoutes.login',
    });

    return res.status(500).json({
      message: 'Error interno del servidor',
    });
  }
});

module.exports = router;
