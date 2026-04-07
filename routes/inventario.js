const express = require('express');
const router = express.Router();
const { 
    getInventarioDetallado, 
    getInventarioConsolidado, 
    getPorVencer, 
    getHistorial ,
    eliminarProducto
} = require('../controllers/inventarioController');

// ✅ Importar middleware de autenticación
const { isAuthenticated } = require('../middleware/auth');

// ✅ Aplicar autenticación a TODAS las rutas de inventario
router.use(isAuthenticated);

// Ruta para eliminar producto
router.delete('/productos/eliminar/:sku', eliminarProducto);

// Ruta principal - Vista CONSOLIDADA
router.get('/', getInventarioConsolidado);

// Vista detallada por lotes
router.get('/detalle', getInventarioDetallado);

router.get('/por-vencer', getPorVencer);
router.get('/historial', getHistorial);

module.exports = router;