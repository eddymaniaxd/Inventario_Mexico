const { promisePool } = require('../config/database');

const getNuevaVenta = async (req, res) => {
    try {
        const sql = `
            SELECT l.id AS lote_id, p.nombre, l.numero_lote, l.fecha_expiracion,
                   (l.entradas - 
                       COALESCE((SELECT SUM(cantidad) FROM movimientos WHERE lote_id = l.id AND tipo = 'VENTA'), 0) +
                       COALESCE((SELECT SUM(cantidad) FROM movimientos WHERE lote_id = l.id AND tipo = 'DEVOLUCION'), 0)
                   ) as stock_actual,
                   DATEDIFF(l.fecha_expiracion, CURDATE()) as dias_para_vencer
            FROM lotes l 
            JOIN productos p ON l.producto_id = p.id
            WHERE p.estado = 'activo'
            AND l.fecha_expiracion > CURDATE()
            HAVING stock_actual > 0
        `;
        
        const [lotes] = await promisePool.query(sql);
        res.render('nueva-venta', { lotes: lotes });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).send('Error al cargar el formulario');
    }
};

const postNuevaVenta = async (req, res) => {
    const { numero_orden, lote_id, cantidad, confirmarVencimiento } = req.body;
    const cantidadNum = parseInt(cantidad);
    const loteIdNum = parseInt(lote_id);
    
    const ordenUnica = `${numero_orden}-VENTA-${Date.now()}`;
    
    console.log('=== POST VENTA ===');
    console.log('Datos recibidos:', { numero_orden, lote_id, cantidad, confirmarVencimiento });
    
    if (!numero_orden || !lote_id || !cantidad) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }
    
    if (cantidadNum <= 0) {
        return res.status(400).json({ error: 'La cantidad debe ser mayor a 0' });
    }
    
    try {
        console.log('📋 Consultando stock del lote...');
        const [stockResult] = await promisePool.query(`
            SELECT 
                l.entradas,
                l.fecha_expiracion,
                COALESCE((SELECT SUM(cantidad) FROM movimientos WHERE lote_id = l.id AND tipo = 'VENTA'), 0) as ventas,
                COALESCE((SELECT SUM(cantidad) FROM movimientos WHERE lote_id = l.id AND tipo = 'DEVOLUCION'), 0) as devoluciones
            FROM lotes l
            WHERE l.id = ?
        `, [loteIdNum]);
        
        if (stockResult.length === 0) {
            return res.status(400).json({ error: 'Lote no encontrado' });
        }
        
        const lote = stockResult[0];
        const entradas = parseInt(lote.entradas) || 0;
        const ventas = parseInt(lote.ventas) || 0;
        const devoluciones = parseInt(lote.devoluciones) || 0;
        
        const stockActual = entradas - ventas + devoluciones;
        
        console.log(`📊 Stock actual: ${stockActual}`);
        
        if (stockActual < cantidadNum) {
            return res.status(400).json({ error: `Stock insuficiente. Disponible: ${stockActual}` });
        }
        
        // ✅ VALIDACIÓN: Verificar vencimiento en 30 días
        const fechaExpiracion = new Date(lote.fecha_expiracion);
        const hoy = new Date();
        const diasParaVencer = Math.floor((fechaExpiracion - hoy) / (1000 * 60 * 60 * 24));
        
        console.log(`📅 Días para vencer: ${diasParaVencer}`);
        
        // ✅ Si vence en 30 días O MENOS y NO ha sido confirmado aún
        if (diasParaVencer <= 30 && diasParaVencer > 0 && !confirmarVencimiento) {
            console.log('⚠️ Producto vence pronto - pidiendo confirmación');
            return res.status(409).json({ 
                warning: true,
                message: `⚠️ Advertencia: Este producto vence en ${diasParaVencer} días`,
                diasParaVencer: diasParaVencer
            });
        }
        
        if (diasParaVencer <= 0) {
            return res.status(400).json({ error: 'No se puede vender un producto vencido' });
        }
        
        // ✅ Si pasó todas las validaciones, insertar la venta
        console.log('✅ Todas las validaciones pasaron, insertando venta...');
        
        // 🔄 Obtener conexión explícita del pool
        let connection;
        try {
            console.log('🔗 Obteniendo conexión del pool...');
            connection = await promisePool.getConnection();
            console.log('✅ Conexión obtenida');
            
            // Iniciar transacción
            console.log('📦 Iniciando transacción...');
            await connection.beginTransaction();
            
            console.log('💾 Insertando orden:', ordenUnica);
            const [ordenInsert] = await connection.query(
                "INSERT INTO ordenes (numero_orden, fecha_registro) VALUES (?, NOW())",
                [ordenUnica]
            );
            console.log('✅ Orden insertada, insertId:', ordenInsert.insertId);
            
            const ordenId = ordenInsert.insertId;
            
            console.log(`💾 Insertando movimiento con orden_id=${ordenId}, lote_id=${loteIdNum}, cantidad=${cantidadNum}`);
            const [movInsert] = await connection.query(
                "INSERT INTO movimientos (orden_id, lote_id, tipo, cantidad) VALUES (?, ?, ?, ?)",
                [ordenId, loteIdNum, 'VENTA', cantidadNum]
            );
            console.log('✅ Movimiento insertado');
            
            // Confirmar transacción
            console.log('✅ Confirmando transacción...');
            await connection.commit();
            console.log('✅ Transacción confirmada');
            
            console.log('\n✅✅✅ VENTA COMPLETADA EXITOSAMENTE ✅✅✅\n');
            return res.status(200).json({ 
                success: true, 
                message: '✅ Venta registrada correctamente'
            });
            
        } catch (transactionErr) {
            console.error('\n❌ ERROR EN TRANSACCIÓN:');
            console.error('Mensaje:', transactionErr.message);
            console.error('Code:', transactionErr.code);
            
            // Revertir transacción
            if (connection) {
                try {
                    console.log('↩️ Revirtiendo transacción...');
                    await connection.rollback();
                    console.log('✅ Transacción revertida');
                } catch (rollbackErr) {
                    console.error('❌ Error al revertir:', rollbackErr.message);
                }
            }
            
            throw transactionErr;
        } finally {
            // Liberar conexión
            if (connection) {
                try {
                    console.log('🔓 Liberando conexión...');
                    await connection.release();
                    console.log('✅ Conexión liberada');
                } catch (releaseErr) {
                    console.error('❌ Error al liberar conexión:', releaseErr.message);
                }
            }
        }
        
    } catch (err) {
        console.error('\n❌ ERROR GENERAL:');
        console.error('Tipo:', err.constructor.name);
        console.error('Mensaje:', err.message);
        console.error('Code:', err.code);
        console.error('Errno:', err.errno);
        
        return res.status(500).json({ 
            error: 'Error al procesar la venta',
            details: err.message,
            code: err.code
        });
    }
};

module.exports = {
    getNuevaVenta,
    postNuevaVenta
};