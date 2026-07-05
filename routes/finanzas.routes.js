const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/finanzas.controller');
const { validate, schemas } = require('../utils/validate');

router.get('/ventas', ctrl.getVentas);
router.delete('/ventas/:id', ctrl.anularVenta);

router.get('/gastos', ctrl.getGastos);
router.post('/gastos', validate(schemas.crearGasto), ctrl.crearGasto);
router.delete('/gastos/:id', ctrl.anularGasto);

module.exports = router;