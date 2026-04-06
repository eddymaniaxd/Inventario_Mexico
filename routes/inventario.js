const express = require('express');
const router = express.Router();
const { 
    getInventarioDetallado, 
    getInventarioConsolidado, 
    getPorVencer, 
    getHistorial 
} = require('../controllers/inventarioController');

// Ruta principal - Vista CONSOLIDADA (recomendada)
router.get('/', getInventarioConsolidado);

// Vista detallada por lotes (alternativa)
router.get('/detalle', getInventarioDetallado);

router.get('/por-vencer', getPorVencer);
router.get('/historial', getHistorial);

module.exports = router;