/**
 * ====================================
 * HISTORY.CONTROLLER.JS - Lógica de Negocio Archivo
 * ====================================
 */

const db = require('../config/db');
const fs = require('fs');

/**
 * Archiva un mes completo
 */
exports.archiveMonth = async (req, res) => {
    try {
        console.log(`\n📦 Recibida solicitud de archivado para: ${req.body.monthKey}`);
        
        const { monthKey, summary, fullData } = req.body;

        if (!monthKey || !summary || !fullData) {
            console.error('❌ Datos de archivado incompletos');
            return res.status(400).json({ success: false, error: 'La solicitud contiene datos incompletos para el archivado.' });
        }

        const query = `
            INSERT OR REPLACE INTO month_archives 
            (month_key, month_name, year, total_income, total_expenses, balance, full_data)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        const totalIncome = parseFloat(summary.totalIncome) || 0;
        const totalExpenses = parseFloat(summary.totalExpenses) || 0;
        const balance = parseFloat(summary.balance) || 0;
        const jsonData = JSON.stringify(fullData);

        db.run(query, [
            monthKey, 
            req.body.monthName, 
            req.body.year,
            totalIncome, 
            totalExpenses, 
            balance, 
            jsonData
        ], function(err) {
            if (err) {
                console.error('❌ Error en SQLite:', err);
                return res.status(500).json({ success: false, error: 'Hubo un problema al guardar el archivo en la base de datos.' });
            }
            console.log(`✅ Mes ${monthKey} archivado correctamente. ID: ${this.lastID}`);
            res.json({ success: true, id: this.lastID });
        });
    } catch (error) {
        console.error('❌ Error crítico al archivar:', error);
        res.status(500).json({ success: false, error: 'Error interno al procesar el cierre de mes.' });
    }
};

/**
 * Obtiene todos los resúmenes
 */
exports.getArchivesSummary = (req, res) => {
    db.all(`SELECT id, month_key, month_name, year, total_income, total_expenses, balance, created_at FROM month_archives ORDER BY year DESC, id DESC`, [], (err, rows) => {
        if (err) {
            console.error('❌ Error al obtener archivos:', err);
            return res.status(500).json({ success: false, error: 'No se pudo recuperar el historial de meses.' });
        }
        res.json({ success: true, archives: rows });
    });
};

/**
 * Obtiene detalles de un mes
 */
exports.getArchiveDetails = (req, res) => {
    db.get(`SELECT * FROM month_archives WHERE id = ?`, [req.params.id], (err, row) => {
        if (err) {
            console.error('❌ Error al obtener detalle:', err);
            return res.status(500).json({ success: false, error: 'Error al consultar los detalles del mes seleccionado.' });
        }
        if (!row) return res.status(404).json({ success: false, error: 'No se encontró la información solicitada.' });
        
        try {
            row.full_data = JSON.parse(row.full_data);
            res.json({ success: true, archive: row });
        } catch (e) {
            res.status(500).json({ success: false, error: 'Error al procesar los datos guardados del mes.' });
        }
    });
};

/**
 * Elimina un mes
 */
exports.deleteArchive = (req, res) => {
    db.run(`DELETE FROM month_archives WHERE id = ?`, [req.params.id], function(err) {
        if (err) {
            console.error('❌ Error al eliminar:', err);
            return res.status(500).json({ success: false, error: 'No se pudo eliminar el registro seleccionado.' });
        }
        res.json({ success: true, message: 'Registro eliminado correctamente.' });
    });
};

/**
 * Limpia todo el historial
 */
exports.deleteAllArchives = (req, res) => {
    db.run(`DELETE FROM month_archives`, [], function(err) {
        if (err) {
            console.error('❌ Error al vaciar:', err);
            return res.status(500).json({ success: false, error: 'Error al intentar vaciar todo el historial.' });
        }
        res.json({ success: true, message: 'El historial ha sido vaciado por completo.' });
    });
};
