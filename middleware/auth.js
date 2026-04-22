const session = require('express-session');

const sessionConfig = session({
    secret: 'mi_secreto_seguro_123456',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 1000 * 60 * 60 * 24
    }
});

const isAuthenticated = (req, res, next) => {
    console.log('Verificando autenticación para:', req.url);
    console.log('Session user:', req.session?.user);
    
    if (req.session && req.session.user) {
        console.log('✅ Usuario autenticado');
        return next();
    }
    
    console.log('❌ No autenticado, redirigiendo a /login');
    res.redirect('/login');
};

// ✅ AGREGAR isAdmin
const isAdmin = (req, res, next) => {
    if (req.session && req.session.user && req.session.user.rol === 'admin') {
        console.log('✅ Usuario admin autorizado');
        return next();
    }
    console.log('❌ Acceso denegado: se requieren permisos de administrador');
    res.status(403).send('Acceso denegado. Se requieren permisos de administrador.');
};

module.exports = {
    sessionConfig,
    isAuthenticated,
    isAdmin  // ← EXPORTAR isAdmin
};