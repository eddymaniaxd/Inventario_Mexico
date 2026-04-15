const express = require('express');
const router = express.Router();
const { getNuevoDanado, postNuevoDanado } = require('../controllers/productosDanadosController');
const { isAuthenticated } = require('../middleware/auth');

router.use(isAuthenticated);

router.get('/nuevo-danado', getNuevoDanado);
router.post('/nuevo-danado', postNuevoDanado);

module.exports = router;