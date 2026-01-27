/**
 * ====================================
 * SERVER.JS - Servidor Express
 * Invoice OCR Processor v3.0
 * ====================================
 * 
 * ACTUALIZACIÓN:
 * Se ha eliminado la dependencia de Gemini AI.
 * Ahora utiliza exclusivamente el motor de análisis local
 * optimizado para facturas de servicios.
 */

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Importar módulos locales
const { processFile } = require('./ocr');
const { parseInvoice } = require('./invoice-parser');

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
app.use(express.static(path.join(__dirname, '..')));

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
        version: '3.0.0',
        parser: 'local-optimized',
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
    console.log('█  PROCESAMIENTO DE FACTURA v3.0 - Motor Local Optimizado');
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
        console.log(`   Tipo: ${mimetype}`);
        console.log(`   Tamaño: ${(size / 1024).toFixed(2)} KB`);
        
        // ==========================================
        // PASO 1: OCR (Extracción de texto)
        // ==========================================
        console.log('\n' + '─'.repeat(50));
        console.log('📋 PASO 1: Extracción de texto (OCR)');
        console.log('─'.repeat(50));
        
        const ocrResult = await processFile(filePath, mimetype);
        
        if (!ocrResult.success) {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            return res.status(422).json({
                success: false,
                error: 'No se pudo procesar el archivo',
                details: ocrResult.error
            });
        }
        
        console.log(`\n   ✓ Texto extraído: ${ocrResult.text.length} caracteres`);
        console.log(`   ✓ Confianza OCR: ${ocrResult.confidence}%`);
        
        // ==========================================
        // PASO 2: ANÁLISIS LOCAL OPTIMIZADO
        // ==========================================
        console.log('\n' + '─'.repeat(50));
        console.log('📋 PASO 2: Análisis inteligente (Motor Local)');
        console.log('─'.repeat(50));
        
        const parseResult = parseInvoice(ocrResult.text);
        
        // Limpiar archivo temporal
        try {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (e) {}
        
        // ==========================================
        // PREPARAR RESPUESTA
        // ==========================================
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        const response = {
            success: true,
            processingTime: `${duration}s`,
            source: 'local',
            
            // Datos principales extraídos
            extracted: {
                amount: parseResult.amount,
                amountFormatted: parseResult.amount 
                    ? `$${parseResult.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                    : null,
                amountConfidence: parseResult.confidence?.amount || 0,
                
                dueDate: parseResult.dueDate,
                dueDateFormatted: parseResult.dueDateFormatted || parseResult.dueDate,
                dueDateConfidence: parseResult.confidence?.date || 0,
                
                barcode: parseResult.barcode,
                barcodeLength: parseResult.barcode ? parseResult.barcode.length : 0,
                barcodeConfidence: parseResult.confidence?.barcode || 0,
                
                provider: parseResult.provider,
                
                customerName: parseResult.customerName || null,
                customerNameConfidence: parseResult.confidence?.customerName || 0
            },
            
            // Alternativas para selección manual si el usuario lo requiere
            alternatives: parseResult.alternatives,
            
            // Metadatos
            meta: {
                ocrConfidence: ocrResult.confidence,
                textLength: ocrResult.text.length,
                parserVersion: '3.0-local',
                provider: parseResult.provider?.name || null
            },
            
            // Debug info
            debug: parseResult.debug,
            
            // Texto completo para referencia
            rawText: ocrResult.text
        };
        
        // Log final en consola
        console.log('\n' + '═'.repeat(70));
        console.log('✅ PROCESAMIENTO COMPLETADO');
        console.log('═'.repeat(70));
        console.log(`   ⏱️  Tiempo: ${duration}s`);
        console.log(`   🏢 Empresa: ${response.extracted.provider?.name || 'No identificado'}`);
        console.log(`   👤 Titular: ${response.extracted.customerName || 'No detectado'}`);
        console.log(`   💵 Monto: ${response.extracted.amountFormatted || '❌ No detectado'}`);
        console.log(`   📅 Vencimiento: ${response.extracted.dueDateFormatted || '❌ No detectada'}`);
        console.log(`   🔢 Código: ${response.extracted.barcode ? '✓ Detectado' : '❌ No detectado'}`);
        console.log('═'.repeat(70) + '\n');
        
        res.json(response);
        
    } catch (error) {
        console.error('\n❌ ERROR:', error);
        
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
});

/**
 * Servir frontend
 */
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
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
    console.log('║  📄 INVOICE OCR PROCESSOR v3.0 - EXCLUSIVO LOCAL                   ║');
    console.log('║  🧠 Motor de Análisis por Reglas y Contexto                        ║');
    console.log('╠' + '═'.repeat(68) + '╣');
    console.log(`║  🚀 Servidor: http://localhost:${PORT}                                  ║`);
    console.log('╚' + '═'.repeat(68) + '╝');
    console.log('\n');
});

module.exports = app;
