const { promisePool } = require('../config/database');

const getNuevaVenta = async (req, res) => {
    try {
        const sql = `
            SELECT l.id AS lote_id, p.nombre, l.numero_lote,
                   (l.entradas - 
                       COALESCE((SELECT SUM(cantidad) FROM movimientos WHERE lote_id = l.id AND tipo = 'VENTA'), 0) +
                       COALESCE((SELECT SUM(cantidad) FROM movimientos WHERE lote_id = l.id AND tipo = 'DEVOLUCION'), 0)
                   ) as stock_actual
            FROM lotes l 
            JOIN productos p ON l.producto_id = p.id
            WHERE p.estado = 'activo'
            AND l.fecha_expiracion > CURDATE()
            HAVING stock_actual > 0
        `;
        
        const [lotes] = await promisePool.query(sql);
        console.log('Lotes con stock:', lotes.map(l => ({ id: l.lote_id, stock: l.stock_actual })));
        res.render('nueva-venta', { lotes: lotes });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).send('Error al cargar el formulario');
    }
};

const postNuevaVenta = async (req, res) => {
    const { numero_orden, lote_id, cantidad } = req.body;
    
    console.log('=== POST VENTA ===');
    console.log('Lote ID:', lote_id);
    console.log('Cantidad:', cantidad);
    
    if (!numero_orden || !lote_id || !cantidad) {
        return res.status(400).send('Todos los campos son obligatorios');
    }
    
    try {
        const [stockResult] = await promisePool.query(`
            SELECT 
                l.entradas,
                COALESCE((SELECT SUM(cantidad) FROM movimientos WHERE lote_id = l.id AND tipo = 'VENTA'), 0) as ventas,
                COALESCE((SELECT SUM(cantidad) FROM movimientos WHERE lote_id = l.id AND tipo = 'DEVOLUCION'), 0) as devoluciones
            FROM lotes l
            WHERE l.id = ?
        `, [lote_id]);
        
        console.log('Resultado:', stockResult);
        
        if (stockResult.length === 0) {
            return res.status(400).send('Lote no encontrado');
        }
        
        // ✅ CONVERTIR A NÚMEROS (parseInt)
        const entradas = parseInt(stockResult[0].entradas) || 0;
        const ventas = parseInt(stockResult[0].ventas) || 0;
        const devoluciones = parseInt(stockResult[0].devoluciones) || 0;
        
        // ✅ AHORA SÍ suma correctamente
        const stockActual = entradas - ventas + devoluciones;
        
        console.log(`Entradas: ${entradas}, Ventas: ${ventas}, Devoluciones: ${devoluciones}, Stock: ${stockActual}`);
        
        if (stockActual < cantidad) {
            return res.status(400).send(`Stock insuficiente. Disponible: ${stockActual}`);
        }
        
        await promisePool.query("INSERT IGNORE INTO ordenes (numero_orden) VALUES (?)", [numero_orden]);
        
        const [ordenRows] = await promisePool.query("SELECT id FROM ordenes WHERE numero_orden = ?", [numero_orden]);
        const ordenId = ordenRows[0].id;
        
        await promisePool.query(
            "INSERT INTO movimientos (orden_id, lote_id, tipo, cantidad) VALUES (?, ?, 'VENTA', ?)",
            [ordenId, lote_id, cantidad]
        );
        
        console.log('✅ Venta exitosa');
        res.redirect('/');
    } catch (err) {
        console.error('Error:', err);
        res.status(500).send('Error al procesar la venta');
    }
};

module.exports = {
    getNuevaVenta,
    postNuevaVenta
};