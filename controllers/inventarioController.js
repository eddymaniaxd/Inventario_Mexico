const { promisePool } = require('../config/database');

// Mostrar inventario DETALLADO por lote (vista original)
const getInventarioDetallado = async (req, res) => {
    try {
        const [results] = await promisePool.query('SELECT * FROM reporte_inventario');
        res.render('index', { inventario: results });
    } catch (err) {
        console.error('Error al cargar inventario:', err);
        res.status(500).send('Error al cargar el inventario');
    }
};

// Mostrar inventario CONSOLIDADO por producto (NUEVO)
const getInventarioConsolidado = async (req, res) => {
    try {
        // Obtener detalle de lotes
        const [lotes] = await promisePool.query('SELECT * FROM reporte_inventario');
        
        // ✅ NUEVO: Obtener cantidad de productos por vencer (próximos 30 días)
        const [porVencer] = await promisePool.query(`
            SELECT COUNT(DISTINCT p.id) as total
            FROM lotes l
            JOIN productos p ON l.producto_id = p.id
            WHERE l.fecha_expiracion BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
            AND l.entradas - COALESCE(
                (SELECT SUM(CASE WHEN m.tipo = 'VENTA' THEN m.cantidad ELSE 0 END) 
                 FROM movimientos m WHERE m.lote_id = l.id), 0
            ) > 0
        `);
        
        const totalPorVencer = porVencer[0].total;
        
        // Agrupar por producto
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
            
            // Acumular totales
            acc[nombre].entradasTotales += Number(lote['Entradas']) || 0;
            acc[nombre].ventasTotales += Number(lote['Total sold']) || 0;
            acc[nombre].devolucionesTotales += Number(lote['Returns']) || 0;
            acc[nombre].stockTotal += Number(lote['Stock Actual']) || 0;
            
            // Guardar detalle del lote
            acc[nombre].lotes.push({
                numero: lote['Lot'],
                expiracion: lote['Exp Date'],
                entradas: lote['Entradas'],
                ventas: lote['Total sold'],
                devoluciones: lote['Returns'],
                stock: lote['Stock Actual']
            });
            
            return acc;
        }, {});
        
        // ✅ MODIFICADO: Enviar también totalPorVencer a la vista
        res.render('index-consolidado', { productos, totalPorVencer });
        
    } catch (err) {
        console.error('Error al cargar inventario consolidado:', err);
        res.status(500).send('Error al cargar el inventario');
    }
};
// Mostrar productos por vencer
const getPorVencer = async (req, res) => {
    try {
        const sql = `
            SELECT p.nombre, l.numero_lote, l.fecha_expiracion, 
                   DATEDIFF(l.fecha_expiracion, CURDATE()) as dias_restantes,
                   l.entradas - COALESCE(SUM(CASE WHEN m.tipo = 'VENTA' THEN m.cantidad ELSE 0 END), 0) as stock_actual
            FROM lotes l
            JOIN productos p ON l.producto_id = p.id
            LEFT JOIN movimientos m ON l.id = m.lote_id
            WHERE l.fecha_expiracion BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 60 DAY)
            GROUP BY l.id
            ORDER BY dias_restantes ASC
        `;
        
        const [results] = await promisePool.query(sql);
        res.render('por-vencer', { productos: results });
    } catch (err) {
        console.error('Error al cargar productos por vencer:', err);
        res.status(500).send('Error al cargar productos por vencer');
    }
};

// Mostrar historial
const getHistorial = async (req, res) => {
    try {
        const sql = `
            SELECT 
                o.fecha_registro,
                m.tipo,
                p.nombre AS producto,
                l.numero_lote,
                o.numero_orden,
                m.cantidad,
                m.motivo_devolucion
            FROM movimientos m
            JOIN ordenes o ON m.orden_id = o.id
            JOIN lotes l ON m.lote_id = l.id
            JOIN productos p ON l.producto_id = p.id
            ORDER BY o.fecha_registro DESC
        `;
        
        const [results] = await promisePool.query(sql);
        res.render('historial', { historial: results });
    } catch (err) {
        console.error('Error al cargar historial:', err);
        res.status(500).send('Error al cargar el historial');
    }
};


module.exports = {
    getInventarioDetallado,
    getInventarioConsolidado,
    getPorVencer,
    getHistorial
};