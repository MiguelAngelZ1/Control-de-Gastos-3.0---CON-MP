/**
 * ====================================
 * DB.JS - Configuración de Base de Datos
 * ====================================
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// El directorio de datos se mantiene en la raíz del backend para persistencia
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'history.db');

// Asegurar que el directorio de datos existe
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('❌ Error al abrir la base de datos:', err.message);
    } else {
        console.log('📦 Conectado a la base de datos SQLite');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.run(`
        CREATE TABLE IF NOT EXISTS month_archives (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            month_key TEXT UNIQUE,
            month_name TEXT,
            year INTEGER,
            total_income REAL,
            total_expenses REAL,
            balance REAL,
            full_data TEXT, -- JSON completo del estado del mes
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error('❌ Error al crear tabla de archivos:', err.message);
    });
}

module.exports = db;
