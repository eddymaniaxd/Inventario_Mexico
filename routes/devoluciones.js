const express = require('express');
const router = express.Router();
const { getNuevaDevolucion, postNuevaDevolucion } = require('../controllers/devolucionesController');

// Formulario y procesamiento de devoluciones
router.get('/nueva-devolucion', getNuevaDevolucion);
router.post('/nueva-devolucion', postNuevaDevolucion);

module.exports = router;