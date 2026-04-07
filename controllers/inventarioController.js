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
        
        // Contar productos por vencer manualmente desde los lotes
        let totalPorVencer = 0;
        const hoy = new Date();
        const dentro30Dias = new Date();
        dentro30Dias.setDate(hoy.getDate() + 30);
        
        for (const lote of lotes) {
            const fechaExpiracion = new Date(lote['Exp Date']);
            const stockActual = Number(lote['Stock Actual']);
            
            if (fechaExpiracion >= hoy && fechaExpiracion <= dentro30Dias && stockActual > 0) {
                totalPorVencer++;
            }
        }
        
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
            SELECT 
                p.nombre, 
                l.numero_lote, 
                l.fecha_expiracion, 
                DATEDIFF(l.fecha_expiracion, CURDATE()) as dias_restantes,
                l.entradas - COALESCE(SUM(CASE WHEN m.tipo = 'VENTA' THEN m.cantidad ELSE 0 END), 0) as stock_actual
            FROM lotes l
            JOIN productos p ON l.producto_id = p.id
            LEFT JOIN movimientos m ON l.id = m.lote_id
            WHERE l.fecha_expiracion BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 60 DAY)
            AND p.estado = 'activo'
            GROUP BY l.id
            HAVING stock_actual > 0
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
                DATE(o.fecha_registro) as fecha,
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
// Eliminar producto (soft delete)
const eliminarProducto = async (req, res) => {
    const { sku } = req.params;
    const { motivo } = req.body;
    
    console.log(`Intentando eliminar producto: ${sku}, motivo: ${motivo}`);
    
    try {
        // Verificar si el producto existe
        const [producto] = await promisePool.query(
            'SELECT * FROM productos WHERE sku = ?',
            [sku]
        );
        
        if (producto.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Producto no encontrado' 
            });
        }
        
        // Actualizar estado del producto
        const [result] = await promisePool.query(
            `UPDATE productos 
             SET estado = 'eliminado', 
                 fecha_eliminacion = NOW(), 
                 motivo_eliminacion = ? 
             WHERE sku = ?`,
            [motivo || 'eliminado', sku]
        );
        
        console.log(`Producto ${sku} actualizado. Filas afectadas: ${result.affectedRows}`);
        
        res.json({ 
            success: true, 
            message: 'Producto eliminado correctamente' 
        });
        
    } catch (err) {
        console.error('Error al eliminar producto:', err);
        res.status(500).json({ 
            success: false, 
            message: err.message 
        });
    }
};

module.exports = {
    getInventarioDetallado,
    getInventarioConsolidado,
    getPorVencer,
    getHistorial,
    eliminarProducto  
};