const express = require('express');
const { closeTable } = require('../controllers/billingController');

const router = express.Router();

router.post('/billing/cerrar-mesa', closeTable);

module.exports = router;
