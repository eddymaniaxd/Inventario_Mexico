const bcrypt = require('bcryptjs');
const mysql = require('mysql2');

const pool = mysql.createPool({
    host: '207.246.108.156',
    port: 33061,
    user: 'root',
    password: '1234eddyxdi?kXD',
    database: 'mexico_inventario'
}).promise();

async function updatePasswords() {
    try {
        // Obtener todos los usuarios
        const [users] = await pool.query('SELECT id, username, password FROM usuarios');
        
        for (const user of users) {
            // Si la contraseña no parece estar encriptada (no empieza con $2)
            if (!user.password.startsWith('$2')) {
                const hashedPassword = await bcrypt.hash(user.password, 10);
                await pool.query('UPDATE usuarios SET password = ? WHERE id = ?', [hashedPassword, user.id]);
                console.log(`✅ Usuario ${user.username} actualizado`);
            } else {
                console.log(`⏭️ Usuario ${user.username} ya está encriptado`);
            }
        }
        
        console.log('🎉 Todas las contraseñas actualizadas');
        process.exit();
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

updatePasswords();