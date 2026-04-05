const { promisePool } = require('../config/database');

// Mostrar inventario principal
const getInventario = async (req, res) => {
    try {
        const [results] = await promisePool.query('SELECT * FROM reporte_inventario');
        res.render('index', { inventario: results });
    } catch (err) {
        console.error('Error al cargar inventario:', err);
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

// Mostrar historial de movimientos
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
    getInventario,
    getPorVencer,
    getHistorial
};