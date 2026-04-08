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
        const [users] = await promisePool.query(
            'SELECT * FROM usuarios WHERE username = ?',
            [username]
        );
        
        if (users.length === 0) {
            console.log('❌ Usuario no existe');
            return res.render('login', { error: 'Usuario o contraseña incorrectos' });
        }
        
        const user = users[0];
        console.log('Usuario encontrado:', user.username);
        console.log('Password en BD (primeros 20):', user.password.substring(0, 20));
        
        let validPassword = false;
        
        // Detectar si la contraseña está encriptada (empieza con $2b$, $2a$, $2y$)
        if (user.password && (user.password.startsWith('$2b$') || user.password.startsWith('$2a$') || user.password.startsWith('$2y$'))) {
            console.log('Contraseña encriptada detectada, usando bcrypt');
            validPassword = await bcrypt.compare(password, user.password);
        } else {
            console.log('Contraseña en texto plano detectada, comparación directa');
            validPassword = (password === user.password);
        }
        
        console.log('Comparación:', validPassword ? '✅ VÁLIDA' : '❌ INVÁLIDA');
        
        if (!validPassword) {
            return res.render('login', { error: 'Usuario o contraseña incorrectos' });
        }
        
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