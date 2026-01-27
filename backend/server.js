/**
 * ====================================
 * SERVER.JS - Servidor Express
 * Invoice OCR Processor v2.0
 * ====================================
 * 
 * CAMBIO PRINCIPAL:
 * Ahora usa invoice-parser.js para análisis inteligente
 * basado en contexto, no solo búsqueda de patrones.
 */

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Importar módulos
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

const GeminiService = require('./gemini-service');

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
        parser: 'hybrid-gemini-local',
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
    console.log('█  PROCESAMIENTO DE FACTURA v2.0 - Parser Inteligente');
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
        // PASO 1: OCR
        // ==========================================
        console.log('\n' + '─'.repeat(50));
        console.log('📋 PASO 1: Extracción de texto (OCR)');
        console.log('─'.repeat(50));
        
        const ocrResult = await processFile(filePath, mimetype);
        
        if (!ocrResult.success) {
            fs.unlinkSync(filePath);
            return res.status(422).json({
                success: false,
                error: 'No se pudo procesar el archivo',
                details: ocrResult.error
            });
        }
        
        console.log(`\n   ✓ Texto extraído: ${ocrResult.text.length} caracteres`);
        console.log(`   ✓ Confianza OCR: ${ocrResult.confidence}%`);
        
        // DEBUG: Mostrar el texto completo para diagnóstico
        console.log('\n   📝 TEXTO EXTRAÍDO (para debug):');
        console.log('   ' + '─'.repeat(50));
        const textLines = ocrResult.text.split('\n').filter(l => l.trim());
        textLines.forEach((line, i) => {
            console.log(`   ${(i+1).toString().padStart(3)}: ${line.substring(0, 80)}${line.length > 80 ? '...' : ''}`);
        });
        console.log('   ' + '─'.repeat(50));
        
        // ==========================================
        // PASO 2: GEMINI AI (First Priority)
        // ==========================================
        console.log('\n' + '─'.repeat(50));
        console.log('🤖 PASO 2: Análisis con Gemini AI');
        console.log('─'.repeat(50));

        let parseResult = null;
        let isGemini = false;

        // Intentar con Gemini primero
        const geminiData = await GeminiService.parseInvoiceWithGemini(ocrResult.text);

        if (geminiData) {
            console.log('   ✅ Gemini procesó la factura exitosamente');
            parseResult = geminiData;
            isGemini = true;
            
            // Normalizar datos de Gemini al formato esperado
            if (!parseResult.confidence) parseResult.confidence = { amount: 95, date: 95, barcode: 95 };
            
            // Mapear campos de Gemini a la estructura del frontend
            if (parseResult.customerName && !parseResult.titular) {
                parseResult.titular = parseResult.customerName;
            }
            
            if (parseResult.provider) {
                if (typeof parseResult.provider === 'string') {
                    parseResult.provider = { name: parseResult.provider };
                }
            } else if (parseResult.providerName) {
                parseResult.provider = { name: parseResult.providerName };
            }
            
            // Verificar código de barras largo
            parseResult.barcodeLength = parseResult.barcode ? parseResult.barcode.length : 0;
        } else {
            console.log('   ⚠️ Gemini falló o no está configurado. Usando parser local.');
        }

        // ==========================================
        // PASO 3: PARSER LOCAL (Fallback)
        // ==========================================
        if (!parseResult) {
            console.log('\n' + '─'.repeat(50));
            console.log('📋 PASO 3: Análisis inteligente (Parser Local v2)');
            console.log('─'.repeat(50));
            
            parseResult = parseInvoice(ocrResult.text);
        }
        
        // Limpiar archivo
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
            source: isGemini ? 'gemini' : 'local',
            
            // Datos principales
            extracted: {
                amount: parseResult.amount,
                amountFormatted: parseResult.amount 
                    ? `$${parseResult.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                    : null,
                amountConfidence: parseResult.confidence ? (parseResult.confidence.amount || 0) : 0,
                
                dueDate: parseResult.dueDate,
                dueDateFormatted: parseResult.dueDateFormatted || parseResult.dueDate,
                dueDateConfidence: parseResult.confidence ? (parseResult.confidence.date || 0) : 0,
                
                barcode: parseResult.barcode,
                barcodeLength: parseResult.barcodeLength,
                barcodeConfidence: parseResult.confidence ? (parseResult.confidence.barcode || 0) : 0,
                
                provider: parseResult.provider,
                
                // Titular del servicio
                customerName: parseResult.customerName || parseResult.titular || null,
                customerNameConfidence: parseResult.confidence ? (parseResult.confidence.customerName || 0) : 0
            },
            
            // Alternativas para selección manual
            alternatives: parseResult.alternatives,
            
            // Metadatos
            meta: {
                ocrConfidence: ocrResult.confidence,
                textLength: ocrResult.text.length,
                parserVersion: '2.0',
                provider: parseResult.provider?.name || null
            },
            
            // Debug info
            debug: parseResult.debug,
            
            // Texto completo
            rawText: ocrResult.text
        };
        
        // Log final
        console.log('\n' + '═'.repeat(70));
        console.log('✅ PROCESAMIENTO COMPLETADO');
        console.log('═'.repeat(70));
        console.log(`   ⏱️  Tiempo: ${duration}s`);
        console.log(`   💵 Monto: ${response.extracted.amountFormatted || '❌ No detectado'} (${response.extracted.amountConfidence}%)`);
        console.log(`   📅 Fecha: ${response.extracted.dueDateFormatted || '❌ No detectada'} (${response.extracted.dueDateConfidence}%)`);
        console.log(`   🔢 Código: ${response.extracted.barcode ? '✓ Detectado' : '❌ No detectado'} (${response.extracted.barcodeConfidence}%)`);
        console.log(`   🏢 Proveedor: ${response.extracted.provider?.name || 'No identificado'}`);
        console.log(`   👤 Titular: ${response.extracted.customerName || 'No detectado'}`);
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

// Manejo de errores
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

// ==========================================
// INICIAR SERVIDOR
// ==========================================
app.listen(PORT, () => {
    console.log('\n');
    console.log('╔' + '═'.repeat(68) + '╗');
    console.log('║  📄 INVOICE OCR PROCESSOR v2.0                                     ║');
    console.log('║  🧠 Parser Inteligente basado en Contexto                          ║');
    console.log('╠' + '═'.repeat(68) + '╣');
    console.log(`║  🚀 Servidor: http://localhost:${PORT}                                  ║`);
    console.log('╠' + '═'.repeat(68) + '╣');
    console.log('║  MEJORAS v2.0:                                                     ║');
    console.log('║  ✓ Análisis de contexto para identificar datos correctos          ║');
    console.log('║  ✓ Scoring de candidatos (como Mercado Pago/Rapipago)              ║');
    console.log('║  ✓ Detección automática de proveedores                             ║');
    console.log('║  ✓ Validación cruzada de datos                                     ║');
    console.log('║  ✓ Filtrado de falsos positivos                                    ║');
    console.log('╚' + '═'.repeat(68) + '╝');
    console.log('\n');
});

module.exports = app;
