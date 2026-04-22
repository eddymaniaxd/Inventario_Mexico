const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const {
    getUsuarios,
    postNuevoUsuario,
    getEditarUsuario,
    postEditarUsuario,
    eliminarUsuario,
    getMiPerfil,
    postMiPerfil
} = require('../controllers/usuariosController');

// Todas las rutas requieren autenticación
router.use(isAuthenticated);

// Listar usuarios (solo admin)
router.get('/', isAdmin, getUsuarios);

// Crear usuario (solo admin) - POST solamente
router.post('/nuevo', isAdmin, postNuevoUsuario);

// Obtener datos de usuario para editar (AJAX)
router.get('/editar/:id', isAdmin, getEditarUsuario);

// Actualizar usuario (solo admin)
router.post('/editar/:id', isAdmin, postEditarUsuario);

// Eliminar usuario (solo admin)
router.delete('/eliminar/:id', isAdmin, eliminarUsuario);

// Mi perfil (cualquier usuario autenticado)
router.get('/perfil', getMiPerfil);
router.post('/perfil', postMiPerfil);

module.exports = router;