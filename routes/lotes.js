const express = require('express');
const router = express.Router();
const { getNuevoLote, postNuevoLote, eliminarLote } = require('../controllers/lotesController');

// Formulario y creación de nuevo lote
router.get('/nuevo-lote', getNuevoLote);
router.post('/nuevo-lote', postNuevoLote);

// Eliminar lote
router.delete('/eliminar/:id', eliminarLote);

module.exports = router;