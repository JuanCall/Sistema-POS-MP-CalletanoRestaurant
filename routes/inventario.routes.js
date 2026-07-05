const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/inventario.controller');
const { validate, schemas } = require('../utils/validate');

router.get('/', ctrl.getInsumos);
router.post('/insumo', validate(schemas.crearInsumo), ctrl.crearInsumo);
router.put('/insumo/:id', validate(schemas.editarInsumo), ctrl.editarInsumo);
router.delete('/insumo/:id', ctrl.deshabilitarInsumo);
router.put('/insumo/:id/habilitar', ctrl.habilitarInsumo);
router.post('/movimiento', validate(schemas.registrarMovimiento), ctrl.registrarMovimiento);

module.exports = router;