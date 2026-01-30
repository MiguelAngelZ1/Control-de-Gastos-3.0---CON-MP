/**
 * ====================================
 * SERVER.JS - Servidor Principal (Backend)
 * ====================================
 * Este es el corazón del sistema. Se encarga de:
 * 1. Servir los archivos estáticos del frontend.
 * 2. Gestionar la subida de facturas (Multer).
 * 3. Orquestar el proceso de OCR e Inteligencia Artificial (Groq).
 * 4. Fusionar los resultados para devolver datos estructurados al usuario.
 */

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Importar módulos locales
const { processFile } = require('./ocr');
const { parseInvoice } = require('./invoice-parser');
const { analyzeInvoiceWithGroq } = require('./groq-ai');

// Configuración
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// Crear directorio de uploads
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Inicializar Express
const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Configuración de Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `invoice-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
        cb(null, allowed.includes(file.mimetype));
    }
});

// ==========================================
// ENDPOINTS
// ==========================================

/**
 * Health Check
 */
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        version: '4.0.0',
        parser: 'hybrid-groq',
        timestamp: new Date().toISOString()
    });
});

/**
 * Procesar factura
 * POST /api/invoice/upload
 */
app.post('/api/invoice/upload', upload.single('invoice'), async (req, res) => {
    console.log('\n');
    console.log('█'.repeat(70));
    console.log('█  PROCESAMIENTO DE FACTURA v4.0 - Groq AI + Motor Local');
    console.log('█'.repeat(70));
    
    const startTime = Date.now();
    
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No se recibió ningún archivo'
            });
        }
        
        const { path: filePath, mimetype, size, originalname } = req.file;
        
        console.log(`\n📎 Archivo: ${originalname}`);
        
        // ==========================================
        // PASO 1: OCR (Extracción de texto)
        // ==========================================
        console.log('\n📋 PASO 1: Extracción de texto');
        const ocrResult = await processFile(filePath, mimetype);
        
        if (!ocrResult.success) {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            return res.status(422).json({
                success: false,
                error: 'No se pudo procesar el archivo',
                details: ocrResult.error
            });
        }
        
        // ==========================================
        // PASO 2: ANÁLISIS INTELIGENTE (GROQ AI + LOCAL)
        // ==========================================
        console.log('\n📋 PASO 2: Análisis inteligente');
        
        const localResults = parseInvoice(ocrResult.text);
        const groqResults = await analyzeInvoiceWithGroq(ocrResult.text);
        
        // FUSIÓN INTELIGENTE v4.2 - PRIORIDAD IA
        // Groq es el "cerebro primario". El motor local es el "respaldo".
        
        const merged = {
            provider: groqResults?.provider || localResults.provider?.name || localResults.provider,
            customerName: groqResults?.customerName || localResults.customerName,
            amount: groqResults?.amount || localResults.amount,
            dueDate: groqResults?.dueDate || localResults.dueDate,
            barcode: groqResults?.barcode || localResults.barcode
        };

        // Si Groq falló completamente, marcamos el origen como local
        const source = groqResults ? 'groq-ai' : 'local-hybrid';

        // Limpiar archivo temporal
        try {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (e) {}
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        const response = {
            success: true,
            processingTime: `${duration}s`,
            source: source,
            
            extracted: {
                amount: merged.amount,
                amountFormatted: merged.amount 
                    ? `$${Number(merged.amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                    : null,
                amountConfidence: groqResults?.amount ? 99 : (localResults.confidence?.amount || 0),
                
                dueDate: merged.dueDate,
                dueDateFormatted: merged.dueDate ? merged.dueDate.split('-').reverse().join('/') : null,
                dueDateConfidence: groqResults?.dueDate ? 99 : (localResults.confidence?.date || 0),
                
                barcode: merged.barcode,
                barcodeConfidence: groqResults?.barcode ? 99 : (localResults.confidence?.barcode || 0),
                
                provider: typeof merged.provider === 'string' ? { name: merged.provider } : merged.provider,
                
                customerName: merged.customerName || null,
                customerNameConfidence: groqResults?.customerName ? 99 : (localResults.confidence?.customerName || 0)
            },
            
            meta: {
                ocrConfidence: ocrResult.confidence,
                parserVersion: '4.1-hybrid'
            },
            
            rawText: ocrResult.text
        };
        
        // Log final
        console.log('\n' + '✅ PROCESAMIENTO COMPLETADO');
        console.log(`   🏢 Empresa: ${response.extracted.provider?.name || 'No identificado'}`);
        console.log(`   📅 Vencimiento: ${response.extracted.dueDateFormatted || '❌'}`);
        console.log(`   💵 Monto: ${response.extracted.amountFormatted || '❌'}`);
        console.log(`   🧠 Origen: ${response.source}`);
        
        res.json(response);
        
    } catch (error) {
        console.error('\n❌ ERROR:', error);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ success: false, error: 'Error interno del servidor', details: error.message });
    }
});

/**
 * Servir frontend
 */
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Manejo de errores global
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'Archivo demasiado grande (máx. 10MB)'
            });
        }
    }
    
    res.status(500).json({
        success: false,
        error: error.message
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log('\n');
    console.log('╔' + '═'.repeat(68) + '╗');
    console.log('║  📄 INVOICE OCR PROCESSOR v4.0 - GROQ AI INTEGRADO                ║');
    console.log('║  🧠 Motor Híbrido: Llama 3.3 + Análisis Local Argentino            ║');
    console.log('╠' + '═'.repeat(68) + '╣');
    console.log(`║  🚀 Servidor: http://localhost:${PORT}                                  ║`);
    console.log('╚' + '═'.repeat(68) + '╝');
    console.log('\n');
});

module.exports = app;
