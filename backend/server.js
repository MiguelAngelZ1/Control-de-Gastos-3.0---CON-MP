/**
 * ====================================
 * SERVER.JS - Punto de Entrada (Backend)
 * ====================================
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
require('dotenv').config();

// Middlewares
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Asegurar carpeta de subidas
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Rutas
const invoiceRoutes = require('./routes/invoice.routes');
const historyRoutes = require('./routes/history.routes');
const paymentRoutes = require('./routes/payment.routes');

app.use('/api/invoice', invoiceRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/payments', paymentRoutes);

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Servir Frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Manejo de errores global (Mensajes genéricos)
app.use((err, req, res, next) => {
    console.error('❌ ERROR GLOBAL:', err.stack);
    res.status(500).json({
        success: false,
        error: 'Ocurrió un error en el servidor. Estamos trabajando para solucionarlo.'
    });
});

// Utilidad para liberar puerto
function clearPort(port) {
    try {
        if (process.platform === 'win32') {
            const cmd = `powershell -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`;
            execSync(cmd);
        } else {
            execSync(`lsof -t -i tcp:${port} | xargs kill -9 > /dev/null 2>&1`);
        }
        return true;
    } catch (e) { return false; }
}

const PORT = process.env.PORT || 3000;

function startServer() {
    const server = app.listen(PORT, () => {
        console.log(`\n🚀 SERVIDOR PROFESIONAL INICIADO: http://localhost:${PORT}\n`);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`⚠️ Puerto ${PORT} ocupado precision. Liberando...`);
            clearPort(PORT);
            setTimeout(startServer, 1000);
        }
    });
}

startServer();
