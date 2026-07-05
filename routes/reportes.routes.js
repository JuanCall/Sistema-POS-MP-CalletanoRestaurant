const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/reportes.controller');
const { validate, schemas } = require('../utils/validate');

router.get('/reporte-diario', ctrl.getReporteDiario);
router.get('/dashboard', ctrl.getDashboard);
router.post('/ia/resumen', validate(schemas.resumenDiarioIA), ctrl.resumenDiarioIA);
router.post('/ia/mensual', validate(schemas.resumenMensualIA), ctrl.resumenMensualIA);

module.exports = router;