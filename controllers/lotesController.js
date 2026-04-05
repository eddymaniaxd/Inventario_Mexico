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
        // Insertar producto (o actualizar si existe)
        const sqlProducto = "INSERT INTO productos (sku, nombre) VALUES (?, ?) ON DUPLICATE KEY UPDATE nombre = VALUES(nombre)";
        await promisePool.query(sqlProducto, [sku, nombre]);
        
        // Obtener ID del producto
        const [rows] = await promisePool.query("SELECT id FROM productos WHERE sku = ?", [sku]);
        const productoId = rows[0].id;
        
        // Insertar lote
        const sqlLote = "INSERT INTO lotes (producto_id, numero_lote, fecha_expiracion, entradas) VALUES (?, ?, ?, ?)";
        await promisePool.query(sqlLote, [productoId, numero_lote, fecha_expiracion, entradas]);
        
        res.redirect('/');
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