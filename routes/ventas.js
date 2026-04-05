const express = require('express');
const router = express.Router();
const { getNuevaVenta, postNuevaVenta } = require('../controllers/ventasController');

// Formulario y procesamiento de ventas
router.get('/nueva-venta', getNuevaVenta);
router.post('/nueva-venta', postNuevaVenta);

module.exports = router;