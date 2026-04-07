const express = require('express');
const router = express.Router();
const { getNuevoLote, postNuevoLote, eliminarLote } = require('../controllers/lotesController');
const { isAuthenticated } = require('../middleware/auth');

router.use(isAuthenticated);

router.get('/nuevo-lote', getNuevoLote);
router.post('/nuevo-lote', postNuevoLote);
router.delete('/eliminar/:id', eliminarLote);

module.exports = router;