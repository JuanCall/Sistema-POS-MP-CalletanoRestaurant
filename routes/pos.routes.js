const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/pos.controller');
const { validate, schemas } = require('../utils/validate');

router.post('/pedidos', validate(schemas.crearPedido), ctrl.crearPedido);
router.put('/mesas/:id/pedido', validate(schemas.modificarPedido), ctrl.modificarPedido);
router.post('/mesas/mover', validate(schemas.moverMesa), ctrl.moverMesa);
router.post('/cobrar', validate(schemas.cobrarMesa), ctrl.cobrarMesa);

module.exports = router;