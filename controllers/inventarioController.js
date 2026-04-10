const { promisePool } = require('../config/database');

// Mostrar inventario consolidado
const getInventarioConsolidado = async (req, res) => {
    try {
        const [lotes] = await promisePool.query('SELECT * FROM reporte_inventario');
        
        const productos = lotes.reduce((acc, lote) => {
            const nombre = lote['Product Name'];
            if (!acc[nombre]) {
                acc[nombre] = {
                    sku: lote['Brand Sku Number'],
                    entradasTotales: 0,
                    ventasTotales: 0,
                    devolucionesTotales: 0,
                    stockTotal: 0,
                    lotes: []
                };
            }
            acc[nombre].entradasTotales += Number(lote['Entradas']) || 0;
            acc[nombre].ventasTotales += Number(lote['Total sold']) || 0;
            acc[nombre].devolucionesTotales += Number(lote['Returns']) || 0;
            acc[nombre].stockTotal += Number(lote['Stock Actual']) || 0;
            acc[nombre].lotes.push({
                numero: lote['Lot'],
                expiracion: lote['Exp Date'],
                stock: lote['Stock Actual']
            });
            return acc;
        }, {});
        
        // Contar productos por vencer
        const [porVencer] = await promisePool.query(`
            SELECT COUNT(DISTINCT p.id) as total
            FROM productos p
            JOIN lotes l ON p.id = l.producto_id
            WHERE l.fecha_expiracion BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
            AND p.estado = 'activo'
            AND l.entradas > (
                SELECT COALESCE(SUM(cantidad), 0) FROM movimientos 
                WHERE lote_id = l.id AND tipo = 'VENTA'
            )
        `);
        
        const totalPorVencer = porVencer[0]?.total || 0;
        res.render('index-consolidado', { productos, totalPorVencer });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).send('Error al cargar inventario');
    }
};

const getInventarioDetallado = async (req, res) => {
    try {
        const [results] = await promisePool.query('SELECT * FROM reporte_inventario');
        res.render('index', { inventario: results });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).send('Error al cargar inventario');
    }
};

const getPorVencer = async (req, res) => {
    try {
        const sql = `
            SELECT p.nombre, l.numero_lote, l.fecha_expiracion,
                   DATEDIFF(l.fecha_expiracion, CURDATE()) as dias_restantes,
                   l.entradas - COALESCE((SELECT SUM(cantidad) FROM movimientos WHERE lote_id = l.id AND tipo = 'VENTA'), 0) as stock_actual
            FROM lotes l
            JOIN productos p ON l.producto_id = p.id
            WHERE l.fecha_expiracion BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 60 DAY)
            AND p.estado = 'activo'
            HAVING stock_actual > 0
            ORDER BY dias_restantes ASC
        `;
        const [results] = await promisePool.query(sql);
        res.render('por-vencer', { productos: results });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).send('Error al cargar productos por vencer');
    }
};

const getHistorial = async (req, res) => {
    try {
        const sql = `
            SELECT o.fecha_registro, m.tipo, p.nombre AS producto, l.numero_lote, o.numero_orden, m.cantidad, m.motivo_devolucion
            FROM movimientos m
            JOIN ordenes o ON m.orden_id = o.id
            JOIN lotes l ON m.lote_id = l.id
            JOIN productos p ON l.producto_id = p.id
            ORDER BY o.fecha_registro DESC
        `;
        const [results] = await promisePool.query(sql);
        res.render('historial', { historial: results });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).send('Error al cargar historial');
    }
};

const eliminarProducto = async (req, res) => {
    const { sku } = req.params;
    const { motivo } = req.body;
    try {
        await promisePool.query('UPDATE productos SET estado = "eliminado", fecha_eliminacion = NOW(), motivo_eliminacion = ? WHERE sku = ?', [motivo || 'eliminado', sku]);
        res.json({ success: true, message: 'Producto eliminado' });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
};

// ✅ FUNCIÓN CORREGIDA PARA VENCIDOS
const getProductosVencidos = async (req, res) => {
    try {
        const sql = `
            SELECT l.id AS lote_id, p.nombre, l.numero_lote, l.fecha_expiracion,
                   l.entradas - COALESCE((SELECT SUM(cantidad) FROM movimientos WHERE lote_id = l.id AND tipo = 'VENTA'), 0) 
                   + COALESCE((SELECT SUM(cantidad) FROM movimientos WHERE lote_id = l.id AND tipo = 'DEVOLUCION'), 0)
                   - COALESCE((SELECT SUM(cantidad) FROM movimientos WHERE lote_id = l.id AND tipo = 'VENCIDO'), 0) as stock_actual
            FROM lotes l
            JOIN productos p ON l.producto_id = p.id
            WHERE l.fecha_expiracion < CURDATE()
            HAVING stock_actual > 0
            ORDER BY l.fecha_expiracion ASC
        `;
        const [lotes] = await promisePool.query(sql);
        res.render('vencidos', { lotes: lotes });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).send('Error al cargar productos vencidos');
    }
};

// ✅ FUNCIÓN CORREGIDA - Usa subconsultas, NO JOINS
const eliminarLoteVencido = async (req, res) => {
    const loteId = req.params.id;
    
    try {
        const [loteInfo] = await promisePool.query(`
            SELECT 
                l.id,
                l.numero_lote,
                l.entradas,
                COALESCE((SELECT SUM(cantidad) FROM movimientos WHERE lote_id = l.id AND tipo = 'VENTA'), 0) as ventas,
                COALESCE((SELECT SUM(cantidad) FROM movimientos WHERE lote_id = l.id AND tipo = 'DEVOLUCION'), 0) as devoluciones,
                COALESCE((SELECT SUM(cantidad) FROM movimientos WHERE lote_id = l.id AND tipo = 'VENCIDO'), 0) as vencidos
            FROM lotes l
            WHERE l.id = ?
        `, [loteId]);
        
        if (loteInfo.length === 0) {
            return res.status(404).send('Lote no encontrado');
        }
        
        // ✅ CONVERTIR A NÚMEROS (parseInt) - ESTO ES CRÍTICO
        const entradas = parseInt(loteInfo[0].entradas) || 0;
        const ventas = parseInt(loteInfo[0].ventas) || 0;
        const devoluciones = parseInt(loteInfo[0].devoluciones) || 0;
        const vencidosPrevios = parseInt(loteInfo[0].vencidos) || 0;
        
        const stockActual = entradas - ventas + devoluciones - vencidosPrevios;
        
        console.log('=== DEBUG VENCIDOS ===');
        console.log('Lote:', loteInfo[0].numero_lote);
        console.log('entradas (number):', entradas);
        console.log('ventas (number):', ventas);
        console.log('devoluciones (number):', devoluciones);
        console.log('vencidosPrevios (number):', vencidosPrevios);
        console.log('stockActual calculado:', stockActual);
        
        if (stockActual <= 0) {
            return res.status(400).send(`Stock actual: ${stockActual}. No se puede retirar.`);
        }
        
        // Crear orden y movimiento
        const numeroOrdenVencido = `VENC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        await promisePool.query("INSERT INTO ordenes (numero_orden, fecha_registro) VALUES (?, NOW())", [numeroOrdenVencido]);
        const [ordenRows] = await promisePool.query("SELECT id FROM ordenes WHERE numero_orden = ?", [numeroOrdenVencido]);
        
        // ✅ Usar stockActual como número, no como string
        await promisePool.query(
            `INSERT INTO movimientos (orden_id, lote_id, tipo, cantidad, motivo_devolucion) 
             VALUES (?, ?, 'VENCIDO', ?, 'Producto vencido - Eliminado del inventario')`,
            [ordenRows[0].id, loteId, stockActual]
        );
        
        console.log(`✅ Retiradas ${stockActual} unidades`);
        res.redirect('/vencidos');
    } catch (err) {
        console.error('Error:', err);
        res.status(500).send('Error al procesar el lote vencido');
    }
};
module.exports = {
    getInventarioConsolidado,
    getInventarioDetallado,
    getPorVencer,
    getHistorial,
    eliminarProducto,
    getProductosVencidos,
    eliminarLoteVencido
};