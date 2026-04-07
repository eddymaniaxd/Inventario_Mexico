const { promisePool } = require('../config/database');

// Mostrar formulario de nueva venta
const getNuevaVenta = async (req, res) => {
    try {
        const sql = `
            SELECT l.id AS lote_id, p.nombre, l.numero_lote 
            FROM lotes l 
            JOIN productos p ON l.producto_id = p.id
            WHERE p.estado = 'activo'
            AND l.fecha_expiracion > CURDATE()
            AND l.entradas - COALESCE(
                (SELECT SUM(CASE WHEN m.tipo = 'VENTA' THEN m.cantidad ELSE 0 END) 
                 FROM movimientos m WHERE m.lote_id = l.id), 0
            ) > 0
        `;
        
        const [lotes] = await promisePool.query(sql);
        res.render('nueva-venta', { lotes: lotes });
    } catch (err) {
        console.error('Error al cargar formulario de venta:', err);
        res.status(500).send('Error al cargar el formulario');
    }
};

// Procesar venta
const postNuevaVenta = async (req, res) => {
    const { numero_orden, lote_id, cantidad } = req.body;
    
    if (!numero_orden || !lote_id || !cantidad) {
        return res.status(400).send('Todos los campos son obligatorios');
    }
    
    if (cantidad <= 0) {
        return res.status(400).send('La cantidad debe ser mayor a 0');
    }
    
    try {
        // Verificar stock disponible
        const checkStock = `
            SELECT l.entradas - COALESCE(SUM(CASE WHEN m.tipo = 'VENTA' THEN m.cantidad ELSE 0 END), 0) as stock_actual,
                   p.estado
            FROM lotes l
            JOIN productos p ON l.producto_id = p.id
            LEFT JOIN movimientos m ON l.id = m.lote_id
            WHERE l.id = ?
            GROUP BY l.id
        `;
        
        const [stockResult] = await promisePool.query(checkStock, [lote_id]);
        const stockActual = stockResult[0]?.stock_actual || 0;
        const estadoProducto = stockResult[0]?.estado;
        
        if (estadoProducto !== 'activo') {
            return res.status(400).send('No se puede vender: Producto no activo');
        }
        
        if (stockActual < cantidad) {
            return res.status(400).send(`Stock insuficiente. Disponible: ${stockActual}`);
        }
        
        await promisePool.query("INSERT IGNORE INTO ordenes (numero_orden) VALUES (?)", [numero_orden]);
        
        const [ordenRows] = await promisePool.query("SELECT id FROM ordenes WHERE numero_orden = ?", [numero_orden]);
        const ordenId = ordenRows[0].id;
        
        const sqlMovimiento = "INSERT INTO movimientos (orden_id, lote_id, tipo, cantidad) VALUES (?, ?, 'VENTA', ?)";
        await promisePool.query(sqlMovimiento, [ordenId, lote_id, cantidad]);
        
        res.redirect('/');
    } catch (err) {
        console.error('Error al procesar venta:', err);
        res.status(500).send('Error al procesar la venta');
    }
};

module.exports = {
    getNuevaVenta,
    postNuevaVenta
};