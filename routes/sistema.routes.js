const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/sistema.controller');
const { validate, schemas } = require('../utils/validate');

router.get('/status', ctrl.getStatus);
router.get('/modo-domingo', ctrl.getModoDomingo);
router.post('/login', validate(schemas.login), ctrl.login);
router.get('/abrir-comprobantes', ctrl.abrirComprobantes);
router.get('/impresoras', ctrl.getImpresoras);
router.get('/config', ctrl.getConfig);
router.post('/config', validate(schemas.setConfig), ctrl.setConfig);

module.exports = router;