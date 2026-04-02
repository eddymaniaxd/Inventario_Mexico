const express = require('express');
const mysql = require('mysql2');
const app = express();

app.set('view engine', 'ejs');
// Esta línea es VITAL para capturar los datos del formulario
app.use(express.urlencoded({ extended: true }));

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root', 
    password: '', 
    database: 'mexico_inventario'
});

db.connect((err) => {
    if (err) throw err;
    console.log('Conectado a MySQL.');
});

// RUTA 1: Ver el inventario
app.get('/', (req, res) => {
    db.query('SELECT * FROM reporte_inventario', (err, results) => {
        if (err) throw err;
        res.render('index', { inventario: results });
    });
});

// RUTA 2: Ver el formulario de registro
app.get('/nuevo-lote', (req, res) => {
    res.render('nuevo-lote');
});

// RUTA 3: Procesar el registro del producto y el lote
app.post('/nuevo-lote', (req, res) => {
    const { sku, nombre, numero_lote, fecha_expiracion, entradas } = req.body;

    // Lógica: 1. Insertar producto (o ignorar si ya existe el SKU)
    const sqlProducto = "INSERT INTO productos (sku, nombre) VALUES (?, ?) ON DUPLICATE KEY UPDATE nombre = VALUES(nombre)";
    
    db.query(sqlProducto, [sku, nombre], (err, result) => {
        if (err) throw err;

        // Buscamos el ID del producto (ya sea recién creado o existente)
        db.query("SELECT id FROM productos WHERE sku = ?", [sku], (err, row) => {
            if (err) throw err;
            const productoId = row[0].id;

            // 2. Insertar el Lote relacionado al producto
            const sqlLote = "INSERT INTO lotes (producto_id, numero_lote, fecha_expiracion, entradas) VALUES (?, ?, ?, ?)";
            db.query(sqlLote, [productoId, numero_lote, fecha_expiracion, entradas], (err) => {
                if (err) throw err;
                // Redirigir al inicio para ver el nuevo registro
                res.redirect('/');
            });
        });
    });
});
// RUTA 4: Ver el formulario de ventas
app.get('/nueva-venta', (req, res) => {
    // Buscamos los productos y sus lotes para mostrarlos en una lista desplegable
    const sql = `
        SELECT l.id AS lote_id, p.nombre, l.numero_lote 
        FROM lotes l 
        JOIN productos p ON l.producto_id = p.id
    `;
    
    db.query(sql, (err, lotes) => {
        if (err) throw err;
        res.render('nueva-venta', { lotes: lotes });
    });
});

// RUTA 5: Procesar la venta
app.post('/nueva-venta', (req, res) => {
    const { numero_orden, lote_id, cantidad } = req.body;

    // 1. Insertamos la orden (usamos IGNORE por si esa orden ya existe y le estamos agregando otro producto)
    db.query("INSERT IGNORE INTO ordenes (numero_orden) VALUES (?)", [numero_orden], (err) => {
        if (err) throw err;
        
        // 2. Buscamos el ID interno de esa orden
        db.query("SELECT id FROM ordenes WHERE numero_orden = ?", [numero_orden], (err, rows) => {
            if (err) throw err;
            const ordenId = rows[0].id;

            // 3. Registramos la VENTA en los movimientos
            const sqlMovimiento = "INSERT INTO movimientos (orden_id, lote_id, tipo, cantidad) VALUES (?, ?, 'VENTA', ?)";
            db.query(sqlMovimiento, [ordenId, lote_id, cantidad], (err) => {
                if (err) throw err;
                // Volvemos al inicio para ver cómo bajó el stock
                res.redirect('/');
            });
        });
    });
});

// RUTA 6: Ver el formulario de devoluciones
app.get('/nueva-devolucion', (req, res) => {
    const sql = `
        SELECT l.id AS lote_id, p.nombre, l.numero_lote 
        FROM lotes l 
        JOIN productos p ON l.producto_id = p.id
    `;
    
    db.query(sql, (err, lotes) => {
        if (err) throw err;
        res.render('nueva-devolucion', { lotes: lotes });
    });
});

// RUTA 7: Procesar la devolución
app.post('/nueva-devolucion', (req, res) => {
    const { numero_orden, lote_id, cantidad, motivo_devolucion } = req.body;

    // 1. Insertamos o ignoramos la orden (por si la orden ya existe)
    db.query("INSERT IGNORE INTO ordenes (numero_orden) VALUES (?)", [numero_orden], (err) => {
        if (err) throw err;
        
        // 2. Buscamos el ID de la orden
        db.query("SELECT id FROM ordenes WHERE numero_orden = ?", [numero_orden], (err, rows) => {
            if (err) throw err;
            const ordenId = rows[0].id;

            // 3. Registramos la DEVOLUCIÓN incluyendo el motivo
            const sqlMovimiento = "INSERT INTO movimientos (orden_id, lote_id, tipo, cantidad, motivo_devolucion) VALUES (?, ?, 'DEVOLUCION', ?, ?)";
            db.query(sqlMovimiento, [ordenId, lote_id, cantidad, motivo_devolucion], (err) => {
                if (err) throw err;
                // Volvemos al inicio
                res.redirect('/');
            });
        });
    });
});

// RUTA 8: Ver el Historial de Movimientos
app.get('/historial', (req, res) => {
    // Esta consulta une las 4 tablas para armar una línea de tiempo completa
    const sql = `
        SELECT 
            o.fecha_registro,
            m.tipo,
            p.nombre AS producto,
            l.numero_lote,
            o.numero_orden,
            m.cantidad,
            m.motivo_devolucion
        FROM movimientos m
        JOIN ordenes o ON m.orden_id = o.id
        JOIN lotes l ON m.lote_id = l.id
        JOIN productos p ON l.producto_id = p.id
        ORDER BY o.fecha_registro DESC
    `;
    
    db.query(sql, (err, resultados) => {
        if (err) throw err;
        res.render('historial', { historial: resultados });
    });
});

app.listen(3000, () => console.log('Servidor en http://localhost:3000'));