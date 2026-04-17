const { promisePool } = require('../config/database');

// Mostrar formulario de nuevo lote
const getNuevoLote = (req, res) => {
    res.render('nuevo-lote');
};

// Función para validar SKU
const validarSKU = (sku) => {
    if (!sku || sku.trim() === '') {
        return { valido: false, mensaje: 'El SKU no puede estar vacío' };
    }
    
    if (sku.length < 3 || sku.length > 50) {
        return { valido: false, mensaje: 'El SKU debe tener entre 3 y 50 caracteres' };
    }
    
    const regex = /^[a-zA-Z0-9_-]+$/;
    if (!regex.test(sku)) {
        return { valido: false, mensaje: 'El SKU solo puede contener letras, números, guiones y guiones bajos' };
    }
    
    return { valido: true, mensaje: '' };
};

// Procesar nuevo lote
const postNuevoLote = async (req, res) => {
    const { sku, nombre, numero_lote, fecha_expiracion, entradas } = req.body;
    
    // Validaciones básicas
    if (!sku || !nombre || !numero_lote || !fecha_expiracion || !entradas) {
        return res.status(400).send('Todos los campos son obligatorios');
    }
    
    if (entradas <= 0) {
        return res.status(400).send('La cantidad de entradas debe ser mayor a 0');
    }
    
    // Validar formato del SKU
    const validacionSKU = validarSKU(sku);
    if (!validacionSKU.valido) {
        return res.status(400).send(validacionSKU.mensaje);
    }
    
    try {
        const connection = await promisePool.getConnection();
        await connection.beginTransaction();
        
        try {
            // ✅ VERIFICAR si el SKU ya existe
            const [productoPorSKU] = await connection.query(
                "SELECT id, nombre, estado FROM productos WHERE sku = ?",
                [sku]
            );
            
            let productoId;
            
            if (productoPorSKU.length > 0) {
                const producto = productoPorSKU[0];
                
                // Caso 1: Mismo SKU, mismo nombre → Agregar lote
                if (producto.nombre === nombre) {
                    productoId = producto.id;
                    
                    if (producto.estado !== 'activo') {
                        await connection.query(
                            "UPDATE productos SET estado = 'activo', fecha_eliminacion = NULL, motivo_eliminacion = NULL WHERE id = ?",
                            [productoId]
                        );
                        console.log(`✅ Producto ${sku} reactivado`);
                    }
                    console.log(`✅ Producto ${sku} existe - agregando nuevo lote`);
                    
                // Caso 2: Mismo SKU, nombre diferente → Error
                } else {
                    await connection.rollback();
                    connection.release();
                    return res.status(400).send(`❌ El SKU "${sku}" ya pertenece al producto "${producto.nombre}". No puedes usarlo para "${nombre}".`);
                }
            } else {
                // ✅ SKU no existe → Verificar si el nombre ya existe en otro producto
                const [productoPorNombre] = await connection.query(
                    "SELECT id, nombre FROM productos WHERE nombre = ? AND estado = 'activo'",
                    [nombre]
                );
                
                if (productoPorNombre.length > 0) {
                    await connection.rollback();
                    connection.release();
                    return res.status(400).send(`❌ El nombre "${nombre}" ya está en uso por otro producto (SKU: ${productoPorNombre[0].nombre}). No puedes duplicar nombres.`);
                }
                
                // Crear nuevo producto
                const [result] = await connection.query(
                    "INSERT INTO productos (sku, nombre, estado) VALUES (?, ?, 'activo')",
                    [sku, nombre]
                );
                productoId = result.insertId;
                console.log(`✅ Nuevo producto ${sku} creado con nombre "${nombre}"`);
            }
            
            // Insertar el lote
            const sqlLote = "INSERT INTO lotes (producto_id, numero_lote, fecha_expiracion, entradas) VALUES (?, ?, ?, ?)";
            const [loteResult] = await connection.query(sqlLote, [productoId, numero_lote, fecha_expiracion, entradas]);
            const loteId = loteResult.insertId;
            
            // Crear orden de entrada
            const numeroOrdenEntrada = `ENT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            const [ordenResult] = await connection.query(
                "INSERT INTO ordenes (numero_orden, fecha_registro) VALUES (?, NOW())", 
                [numeroOrdenEntrada]
            );
            const ordenId = ordenResult.insertId;
            
            // Registrar movimiento
            const sqlMovimiento = `
                INSERT INTO movimientos (orden_id, lote_id, tipo, cantidad, motivo_devolucion) 
                VALUES (?, ?, 'ENTRADA', ?, ?)`;
            await connection.query(sqlMovimiento, [ordenId, loteId, entradas, `Entrada de nuevo lote: ${numero_lote}`]);
            
            await connection.commit();
            res.redirect('/');
            
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
        
    } catch (err) {
        console.error('Error al crear nuevo lote:', err);
        res.status(500).send('Error al crear el nuevo lote: ' + err.message);
    }
};

// Eliminar lote
const eliminarLote = async (req, res) => {
    const loteId = req.params.id;
    
    try {
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