const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/menu.controller');
const { validate, schemas } = require('../utils/validate');

router.get('/mesas', ctrl.getMesas);
router.get('/carta', ctrl.getCarta);
router.get('/admin/data-cruda', ctrl.getDataCruda);

router.get('/platos/:id/receta', ctrl.getReceta);
router.post('/platos/:id/receta', validate(schemas.agregarInsumoReceta), ctrl.agregarInsumoReceta);
router.delete('/recetas/:id', ctrl.eliminarInsumoReceta);

module.exports = router;