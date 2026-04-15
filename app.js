const express = require('express');
const path = require('path');
const app = express();

// Importar rutas
const inventarioRoutes = require('./routes/inventario');
const ventasRoutes = require('./routes/ventas');
const devolucionesRoutes = require('./routes/devoluciones');
const lotesRoutes = require('./routes/lotes');
const authRoutes = require('./routes/auth');  // ← NUEVA RUTA
const danadosRoutes = require('./routes/danados'); 

// Configuraciones
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configurar sesiones (antes de las rutas)
const { sessionConfig } = require('./middleware/auth');
app.use(sessionConfig);

// Middleware para pasar usuario a todas las vistas
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

// Usar rutas
app.use('/', authRoutes);  // ← NUEVA (rutas de login)
app.use('/', inventarioRoutes);
app.use('/ventas', ventasRoutes);
app.use('/devoluciones', devolucionesRoutes);
app.use('/lotes', lotesRoutes);
app.use('/danados', danadosRoutes);

// Resto del código...

// Manejo de errores 404
app.use((req, res) => {
    res.status(404).send('Página no encontrada');
});

// Manejo de errores general
app.use((err, req, res, next) => {
    console.error('Error no manejado:', err);
    res.status(500).send('Error interno del servidor');
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});