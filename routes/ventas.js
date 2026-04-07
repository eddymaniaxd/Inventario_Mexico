const express = require('express');
const router = express.Router();
const { getNuevaVenta, postNuevaVenta } = require('../controllers/ventasController');
const { isAuthenticated } = require('../middleware/auth');

router.use(isAuthenticated);

router.get('/nueva-venta', getNuevaVenta);
router.post('/nueva-venta', postNuevaVenta);

module.exports = router;