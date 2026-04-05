const mysql = require('mysql2');

// Crear pool de conexiones (mejor que conexión simple)
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'mexico_inventario',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Versión con promesas para usar async/await
const promisePool = pool.promise();

// Exportar ambos estilos
module.exports = {
    pool,
    promisePool
};