const { promisePool } = require('../config/database');

// Mostrar formulario de registro de producto dañado
const getNuevoDanado = async (req, res) => {
    try {
        const sql = `
            SELECT l.id AS lote_id, p.nombre, l.numero_lote,
                   (l.entradas - COALESCE((SELECT SUM(cantidad) FROM movimientos WHERE lote_id = l.id AND tipo = 'VENTA'), 0) 
                    + COALESCE((SELECT SUM(cantidad) FROM movimientos WHERE lote_id = l.id AND tipo = 'DEVOLUCION'), 0)
                    - COALESCE((SELECT SUM(cantidad) FROM movimientos WHERE lote_id = l.id AND tipo = 'VENCIDO'), 0)
                    - COALESCE((SELECT SUM(cantidad) FROM movimientos WHERE lote_id = l.id AND tipo = 'DAÑADO'), 0)) as stock_actual
            FROM lotes l 
            JOIN productos p ON l.producto_id = p.id
            WHERE p.estado = 'activo'
            GROUP BY l.id
            HAVING stock_actual > 0
            ORDER BY p.nombre, l.numero_lote
        `;
        
        const [lotes] = await promisePool.query(sql);
        console.log('Lotes disponibles para registrar dañados:', lotes.length);
        res.render('nuevo-danado', { lotes: lotes });
    } catch (err) {
        console.error('Error al cargar formulario:', err);
        res.status(500).send('Error al cargar el formulario');
    }
};

// Procesar registro de producto dañado
// Procesar registro de producto dañado
const postNuevoDanado = async (req, res) => {
    const { numero_orden, lote_id, cantidad, motivo_danado } = req.body;
    
    // ✅ CONVERTIR a número
    const cantidadNum = parseInt(cantidad);
    
    // ✅ Crear una orden ÚNICA para este daño
    const ordenUnica = `${numero_orden}-DANADO-${Date.now()}`;
    
    console.log('=== POST PRODUCTO DAÑADO ===');
    console.log('Orden única generada:', ordenUnica);
    console.log('Lote ID:', lote_id);
    console.log('Cantidad:', cantidadNum);
    console.log('Motivo:', motivo_danado);
    
    if (!numero_orden || !lote_id || !cantidad) {
        return res.status(400).send('Número de orden, lote y cantidad son obligatorios');
    }
    
    if (cantidadNum <= 0) {
        return res.status(400).send('La cantidad debe ser mayor a 0');
    }
    
    try {
        // Verificar que haya suficiente stock
        const [stockCheck] = await promisePool.query(`
            SELECT (l.entradas - COALESCE((SELECT SUM(cantidad) FROM movimientos WHERE lote_id = l.id AND tipo = 'VENTA'), 0) 
                    + COALESCE((SELECT SUM(cantidad) FROM movimientos WHERE lote_id = l.id AND tipo = 'DEVOLUCION'), 0)
                    - COALESCE((SELECT SUM(cantidad) FROM movimientos WHERE lote_id = l.id AND tipo = 'VENCIDO'), 0)
                    - COALESCE((SELECT SUM(cantidad) FROM movimientos WHERE lote_id = l.id AND tipo = 'DAÑADO'), 0)) as stock_actual
            FROM lotes l
            WHERE l.id = ?
        `, [lote_id]);
        
        const stockActual = stockCheck[0]?.stock_actual || 0;
        
        console.log('Stock actual en BD:', stockActual);
        
        if (stockActual < cantidadNum) {
            return res.status(400).send(`Stock insuficiente. Disponible: ${stockActual} unidades`);
        }
        
        // ✅ Insertar NUEVA orden con fecha actual
        await promisePool.query(
            "INSERT INTO ordenes (numero_orden, fecha_registro) VALUES (?, NOW())", 
            [ordenUnica]
        );
        
        const [ordenRows] = await promisePool.query("SELECT id FROM ordenes WHERE numero_orden = ?", [ordenUnica]);
        const ordenId = ordenRows[0].id;
        
        // Registrar producto dañado
        const sqlMovimiento = `INSERT INTO movimientos (orden_id, lote_id, tipo, cantidad, motivo_devolucion) 
                                VALUES (?, ?, 'DAÑADO', ?, ?)`;
        await promisePool.query(sqlMovimiento, [ordenId, lote_id, cantidadNum, motivo_danado || null]);
        
        console.log('✅ Producto dañado registrado exitosamente');
        res.redirect('/');
    } catch (err) {
        console.error('Error al procesar producto dañado:', err);
        res.status(500).send('Error al procesar el registro');
    }
};

module.exports = {
    getNuevoDanado,
    postNuevoDanado
};