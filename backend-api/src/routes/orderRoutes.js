const express = require('express');
const {
  createOrder,
  getMesas,
  getMesaById,
} = require('../controllers/orderController');

const router = express.Router();

router.post('/pedidos', createOrder);
router.get('/mesas', getMesas);
router.get('/mesas/:id', getMesaById);

module.exports = router;
