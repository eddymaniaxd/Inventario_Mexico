const { promisePool } = require('../config/database');

// Mostrar formulario de nuevo lote
const getNuevoLote = (req, res) => {
    res.render('nuevo-lote');
};

// Procesar nuevo lote
const postNuevoLote = async (req, res) => {
    const { sku, nombre, numero_lote, fecha_expiracion, entradas } = req.body;
    
    // Validaciones
    if (!sku || !nombre || !numero_lote || !fecha_expiracion || !entradas) {
        return res.status(400).send('Todos los campos son obligatorios');
    }
    
    if (entradas <= 0) {
        return res.status(400).send('La cantidad de entradas debe ser mayor a 0');
    }
    
    try {
        // Iniciar transacción (para asegurar que todo se guarde o nada)
        const connection = await promisePool.getConnection();
        await connection.beginTransaction();
        
        try {
            // 1. Insertar producto (o actualizar si existe) - Asegurar estado activo
            const sqlProducto = `INSERT INTO productos (sku, nombre, estado) 
                                 VALUES (?, ?, 'activo') 
                                 ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), estado = 'activo'`;
            await connection.query(sqlProducto, [sku, nombre]);
            
            // 2. Obtener ID del producto
            const [rows] = await connection.query("SELECT id FROM productos WHERE sku = ?", [sku]);
            const productoId = rows[0].id;
            
            // 3. Insertar el lote
            const sqlLote = "INSERT INTO lotes (producto_id, numero_lote, fecha_expiracion, entradas) VALUES (?, ?, ?, ?)";
            const [loteResult] = await connection.query(sqlLote, [productoId, numero_lote, fecha_expiracion, entradas]);
            const loteId = loteResult.insertId;
            
            // 4. Crear una orden de entrada (para tener trazabilidad)
            const numeroOrdenEntrada = `ENT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            const [ordenResult] = await connection.query(
                "INSERT INTO ordenes (numero_orden, fecha_registro) VALUES (?, NOW())", 
                [numeroOrdenEntrada]
            );
            const ordenId = ordenResult.insertId;
            
            // 5. Registrar el movimiento como ENTRADA en el historial
            const sqlMovimiento = `
                INSERT INTO movimientos (orden_id, lote_id, tipo, cantidad, motivo_devolucion) 
                VALUES (?, ?, 'ENTRADA', ?, ?)`;
            await connection.query(sqlMovimiento, [ordenId, loteId, entradas, `Entrada de nuevo lote: ${numero_lote}`]);
            
            // Confirmar la transacción
            await connection.commit();
            
            res.redirect('/');
        } catch (err) {
            // Si hay error, deshacer todo
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
        
    } catch (err) {
        console.error('Error al crear nuevo lote:', err);
        res.status(500).send('Error al crear el nuevo lote');
    }
};

// Eliminar lote (solo si no tiene movimientos)
const eliminarLote = async (req, res) => {
    const loteId = req.params.id;
    
    try {
        // Verificar si tiene movimientos
        const [movimientos] = await promisePool.query("SELECT COUNT(*) as total FROM movimientos WHERE lote_id = ?", [loteId]);
        
        if (movimientos[0].total > 0) {
            return res.status(400).send('No se puede eliminar un lote con movimientos asociados');
        }
        
        await promisePool.query("DELETE FROM lotes WHERE id = ?", [loteId]);
        res.redirect('/');
    } catch (err) {
        console.error('Error al eliminar lote:', err);
        res.status(500).send('Error al eliminar el lote');
    }
};

module.exports = {
    getNuevoLote,
    postNuevoLote,
    eliminarLote
};