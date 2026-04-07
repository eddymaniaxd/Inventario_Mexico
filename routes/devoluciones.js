const express = require('express');
const router = express.Router();
const { getNuevaDevolucion, postNuevaDevolucion } = require('../controllers/devolucionesController');
const { isAuthenticated } = require('../middleware/auth');

router.use(isAuthenticated);

router.get('/nueva-devolucion', getNuevaDevolucion);
router.post('/nueva-devolucion', postNuevaDevolucion);

module.exports = router;