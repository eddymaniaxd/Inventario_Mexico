const { promisePool } = require('../config/database');

// Mostrar formulario de nueva devolución
const getNuevaDevolucion = async (req, res) => {
    try {
        const sql = `
            SELECT DISTINCT l.id AS lote_id, p.nombre, l.numero_lote
            FROM lotes l 
            JOIN productos p ON l.producto_id = p.id
            WHERE p.estado = 'activo'
            ORDER BY p.nombre, l.numero_lote
        `;
        
        const [lotes] = await promisePool.query(sql);
        console.log('Lotes disponibles para devolución:', lotes.length);
        res.render('nueva-devolucion', { lotes: lotes });
    } catch (err) {
        console.error('Error al cargar formulario de devolución:', err);
        res.status(500).send('Error al cargar el formulario');
    }
};

// Procesar devolución
const postNuevaDevolucion = async (req, res) => {
    const { numero_orden, lote_id, cantidad, motivo_devolucion } = req.body;
    
    // ✅ Convertir cantidad a número
    const cantidadNum = parseInt(cantidad);
    
    // ✅ Crear orden ÚNICA para esta devolución
    const ordenUnica = `${numero_orden}-DEVOLUCION-${Date.now()}`;
    
    console.log('=== POST DEVOLUCIÓN ===');
    console.log('Orden única generada:', ordenUnica);
    console.log('Lote ID:', lote_id);
    console.log('Cantidad:', cantidadNum);
    console.log('Motivo:', motivo_devolucion);
    
    if (!numero_orden || !lote_id || !cantidad) {
        return res.status(400).send('Número de orden, lote y cantidad son obligatorios');
    }
    
    if (cantidadNum <= 0) {
        return res.status(400).send('La cantidad debe ser mayor a 0');
    }
    
    try {
        // ✅ Insertar NUEVA orden con fecha actual
        await promisePool.query(
            "INSERT INTO ordenes (numero_orden, fecha_registro) VALUES (?, NOW())",
            [ordenUnica]
        );
        
        const [ordenRows] = await promisePool.query("SELECT id FROM ordenes WHERE numero_orden = ?", [ordenUnica]);
        const ordenId = ordenRows[0].id;
        
        // Registrar devolución
        const sqlMovimiento = `INSERT INTO movimientos (orden_id, lote_id, tipo, cantidad, motivo_devolucion) 
                                VALUES (?, ?, 'DEVOLUCION', ?, ?)`;
        await promisePool.query(sqlMovimiento, [ordenId, lote_id, cantidadNum, motivo_devolucion || null]);
        
        console.log('✅ Devolución registrada exitosamente');
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