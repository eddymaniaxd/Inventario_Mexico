const express = require('express');
const router = express.Router();
const { getInventario, getPorVencer, getHistorial } = require('../controllers/inventarioController');

// Ruta principal del inventario
router.get('/', getInventario);

// Ruta de productos por vencer
router.get('/por-vencer', getPorVencer);

// Ruta de historial
router.get('/historial', getHistorial);

module.exports = router;