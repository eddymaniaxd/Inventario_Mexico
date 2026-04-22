const { promisePool } = require('../config/database');
const bcrypt = require('bcryptjs');

// ============ LISTAR USUARIOS ============
const getUsuarios = async (req, res) => {
    try {
        const [usuarios] = await promisePool.query(`
            SELECT id, username, nombre, rol, activo, 
                   DATE_FORMAT(created_at, '%d/%m/%Y') as fecha_creacion_fmt
            FROM usuarios 
            ORDER BY id DESC
        `);
        
        res.render('usuarios', { 
            usuarios: usuarios,
            user: req.session.user 
        });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).send('Error al cargar usuarios: ' + err.message);
    }
};

// ============ CREAR USUARIO (responde JSON para modal) ============
const postNuevoUsuario = async (req, res) => {
    const { username, password, nombre, rol } = req.body;
    
    // Validaciones
    if (!username || !password || !nombre || !rol) {
        return res.json({ 
            success: false, 
            error: 'Todos los campos son obligatorios' 
        });
    }
    
    if (username.length < 3) {
        return res.json({ 
            success: false, 
            error: 'El usuario debe tener al menos 3 caracteres' 
        });
    }
    
    if (password.length < 4) {
        return res.json({ 
            success: false, 
            error: 'La contraseña debe tener al menos 4 caracteres' 
        });
    }
    
    try {
        const [existe] = await promisePool.query(
            'SELECT id FROM usuarios WHERE username = ?',
            [username]
        );
        
        if (existe.length > 0) {
            return res.json({ 
                success: false, 
                error: `El usuario "${username}" ya existe` 
            });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        await promisePool.query(
            `INSERT INTO usuarios (username, password, nombre, rol, activo) 
             VALUES (?, ?, ?, ?, 1)`,
            [username, hashedPassword, nombre, rol]
        );
        
        res.json({ success: true });
    } catch (err) {
        console.error('Error:', err);
        res.json({ 
            success: false, 
            error: 'Error al crear usuario: ' + err.message 
        });
    }
};

// ============ OBTENER USUARIO PARA EDITAR (responde JSON) ============
const getEditarUsuario = async (req, res) => {
    const { id } = req.params;
    
    try {
        const [usuarios] = await promisePool.query(
            'SELECT id, username, nombre, rol, activo FROM usuarios WHERE id = ?',
            [id]
        );
        
        if (usuarios.length === 0) {
            return res.json({ 
                success: false, 
                message: 'Usuario no encontrado' 
            });
        }
        
        res.json({ 
            success: true, 
            usuario: usuarios[0] 
        });
    } catch (err) {
        console.error('Error:', err);
        res.json({ 
            success: false, 
            message: err.message 
        });
    }
};

// ============ ACTUALIZAR USUARIO (responde JSON) ============
const postEditarUsuario = async (req, res) => {
    const { id } = req.params;
    const { nombre, rol, password, activo } = req.body;
    
    try {
        let query = 'UPDATE usuarios SET nombre = ?, rol = ?, activo = ?';
        let params = [nombre, rol, activo || 1];
        
        if (password && password.trim() !== '') {
            const hashedPassword = await bcrypt.hash(password, 10);
            query += ', password = ?';
            params.push(hashedPassword);
        }
        
        query += ' WHERE id = ?';
        params.push(id);
        
        await promisePool.query(query, params);
        
        res.json({ success: true });
    } catch (err) {
        console.error('Error:', err);
        res.json({ 
            success: false, 
            error: 'Error al actualizar usuario: ' + err.message 
        });
    }
};

// ============ ELIMINAR USUARIO ============
const eliminarUsuario = async (req, res) => {
    const { id } = req.params;
    
    try {
        if (parseInt(id) === req.session.user.id) {
            return res.json({ 
                success: false, 
                message: 'No puedes eliminar tu propio usuario' 
            });
        }
        
        await promisePool.query('DELETE FROM usuarios WHERE id = ?', [id]);
        
        res.json({ success: true, message: 'Usuario eliminado correctamente' });
    } catch (err) {
        console.error('Error:', err);
        res.json({ success: false, message: err.message });
    }
};

// ============ MI PERFIL ============
const getMiPerfil = async (req, res) => {
    try {
        const [usuarios] = await promisePool.query(
            'SELECT id, username, nombre, rol FROM usuarios WHERE id = ?',
            [req.session.user.id]
        );
        
        res.render('mi-perfil', { 
            usuario: usuarios[0], 
            error: null,
            success: null,
            user: req.session.user 
        });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).send('Error al cargar perfil');
    }
};

const postMiPerfil = async (req, res) => {
    const { nombre, password_actual, password_nueva } = req.body;
    const userId = req.session.user.id;
    
    try {
        const [usuarios] = await promisePool.query(
            'SELECT password FROM usuarios WHERE id = ?',
            [userId]
        );
        
        const validPassword = await bcrypt.compare(password_actual, usuarios[0].password);
        
        if (!validPassword) {
            return res.render('mi-perfil', {
                usuario: { nombre, username: req.session.user.username },
                error: 'Contraseña actual incorrecta',
                success: null,
                user: req.session.user
            });
        }
        
        let query = 'UPDATE usuarios SET nombre = ?';
        let params = [nombre];
        
        if (password_nueva && password_nueva.trim() !== '') {
            if (password_nueva.length < 4) {
                return res.render('mi-perfil', {
                    usuario: { nombre, username: req.session.user.username },
                    error: 'La nueva contraseña debe tener al menos 4 caracteres',
                    success: null,
                    user: req.session.user
                });
            }
            const hashedPassword = await bcrypt.hash(password_nueva, 10);
            query += ', password = ?';
            params.push(hashedPassword);
        }
        
        query += ' WHERE id = ?';
        params.push(userId);
        
        await promisePool.query(query, params);
        
        req.session.user.nombre = nombre;
        
        res.render('mi-perfil', {
            usuario: { nombre, username: req.session.user.username },
            error: null,
            success: 'Perfil actualizado correctamente',
            user: req.session.user
        });
    } catch (err) {
        console.error('Error:', err);
        res.render('mi-perfil', {
            usuario: { nombre, username: req.session.user.username },
            error: 'Error al actualizar perfil',
            success: null,
            user: req.session.user
        });
    }
};

module.exports = {
    getUsuarios,
    postNuevoUsuario,
    getEditarUsuario,
    postEditarUsuario,
    eliminarUsuario,
    getMiPerfil,
    postMiPerfil
};