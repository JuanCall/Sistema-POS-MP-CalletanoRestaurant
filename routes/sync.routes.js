const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/sync.controller');
const { validate, schemas } = require('../utils/validate');

router.get('/init-sync', ctrl.initSync);
router.post('/admin/menu', validate(schemas.adminMenu), ctrl.setAdminMenu);
router.post('/admin/carta', validate(schemas.adminCarta), ctrl.setAdminCarta);
router.post('/admin/estado', validate(schemas.adminEstado), ctrl.setAdminEstado);

module.exports = router;