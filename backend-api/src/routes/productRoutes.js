const express = require('express');
const {
  getCategorias,
  getProductos,
} = require('../controllers/productController');

const router = express.Router();

router.get('/categorias', getCategorias);
router.get('/productos', getProductos);

module.exports = router;
