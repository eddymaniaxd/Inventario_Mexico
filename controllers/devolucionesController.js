const { promisePool } = require('../config/database');

// Mostrar formulario de nueva devolución
const getNuevaDevolucion = async (req, res) => {
    try {
        const sql = `
            SELECT l.id AS lote_id, p.nombre, l.numero_lote 
            FROM lotes l 
            JOIN productos p ON l.producto_id = p.id
            WHERE p.estado = 'activo'
            AND l.entradas - COALESCE(
                (SELECT SUM(CASE WHEN m.tipo = 'VENTA' THEN m.cantidad ELSE 0 END) 
                 FROM movimientos m WHERE m.lote_id = l.id), 0
            ) > 0
        `;
        
        const [lotes] = await promisePool.query(sql);
        res.render('nueva-devolucion', { lotes: lotes });
    } catch (err) {
        console.error('Error al cargar formulario de devolución:', err);
        res.status(500).send('Error al cargar el formulario');
    }
};

// Procesar devolución
const postNuevaDevolucion = async (req, res) => {
    const { numero_orden, lote_id, cantidad, motivo_devolucion } = req.body;
    
    if (!numero_orden || !lote_id || !cantidad) {
        return res.status(400).send('Número de orden, lote y cantidad son obligatorios');
    }
    
    if (cantidad <= 0) {
        return res.status(400).send('La cantidad debe ser mayor a 0');
    }
    
    try {
        await promisePool.query("INSERT IGNORE INTO ordenes (numero_orden) VALUES (?)", [numero_orden]);
        
        const [ordenRows] = await promisePool.query("SELECT id FROM ordenes WHERE numero_orden = ?", [numero_orden]);
        const ordenId = ordenRows[0].id;
        
        const sqlMovimiento = "INSERT INTO movimientos (orden_id, lote_id, tipo, cantidad, motivo_devolucion) VALUES (?, ?, 'DEVOLUCION', ?, ?)";
        await promisePool.query(sqlMovimiento, [ordenId, lote_id, cantidad, motivo_devolucion || null]);
        
        res.redirect('/');
    } catch (err) {
        console.error('Error al procesar devolución:', err);
        res.status(500).send('Error al procesar la devolución');
    }
};

module.exports = {
    getNuevaDevolucion,
    postNuevaDevolucion
};