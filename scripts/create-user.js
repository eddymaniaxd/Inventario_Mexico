const bcrypt = require('bcryptjs');
const mysql = require('mysql2');
const readline = require('readline');

const pool = mysql.createPool({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '',
    database: 'mexico_inventario'
}).promise();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function createUser() {
    rl.question('Usuario: ', async (username) => {
        rl.question('Contraseña: ', async (password) => {
            rl.question('Nombre completo: ', async (nombre) => {
                rl.question('Rol (admin/vendedor/almacen): ', async (rol) => {
                    try {
                        const hashedPassword = await bcrypt.hash(password, 10);
                        
                        await pool.query(
                            'INSERT INTO usuarios (username, password, nombre, rol) VALUES (?, ?, ?, ?)',
                            [username, hashedPassword, nombre, rol]
                        );
                        
                        console.log(`✅ Usuario ${username} creado correctamente`);
                        process.exit();
                    } catch (err) {
                        console.error('Error:', err);
                        process.exit(1);
                    }
                });
            });
        });
    });
}

createUser();