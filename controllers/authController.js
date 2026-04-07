const { promisePool } = require('../config/database');
const bcrypt = require('bcryptjs');

const getLogin = (req, res) => {
    res.render('login', { error: null });
};

const postLogin = async (req, res) => {
    const { username, password } = req.body;
    
    console.log('=== INTENTO DE LOGIN ===');
    console.log('Usuario:', username);
    
    try {
        // Buscar usuario
        const [users] = await promisePool.query(
            'SELECT * FROM usuarios WHERE username = ?',
            [username]
        );
        
        console.log('Usuarios encontrados en BD:', users.length);
        
        if (users.length === 0) {
            console.log('❌ Usuario no existe en BD');
            return res.render('login', { error: 'Usuario o contraseña incorrectos' });
        }
        
        const user = users[0];
        console.log('Usuario encontrado:', user.username);
        
        // Verificar contraseña encriptada
        const validPassword = await bcrypt.compare(password, user.password);
        
        console.log('Comparación:', validPassword ? '✅ VÁLIDA' : '❌ INVÁLIDA');
        
        if (!validPassword) {
            console.log('❌ Contraseña incorrecta');
            return res.render('login', { error: 'Usuario o contraseña incorrectos' });
        }
        
        // Guardar sesión
        req.session.user = {
            id: user.id,
            username: user.username,
            nombre: user.nombre,
            rol: user.rol
        };
        
        console.log('✅ Login exitoso! Redirigiendo a /');
        res.redirect('/');
        
    } catch (err) {
        console.error('Error en login:', err);
        res.render('login', { error: 'Error al iniciar sesión: ' + err.message });
    }
};

const logout = (req, res) => {
    req.session.destroy();
    res.redirect('/login');
};

module.exports = {
    getLogin,
    postLogin,
    logout
};