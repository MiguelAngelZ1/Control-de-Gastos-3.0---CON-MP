/**
 * ====================================
 * INVOICE.CONTROLLER.JS - Procesamiento de Comprobantes
 * ====================================
 */

const fs = require('fs');
const ocrService = require('../services/ocr.service');
const parserService = require('../services/parser.service');
const aiService = require('../services/ai.service');

/**
 * Procesa la subida y análisis de una factura
 */
exports.uploadAndProcess = async (req, res) => {
    const startTime = Date.now();
    
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'Debe seleccionar un archivo válido (Imagen o PDF).'
            });
        }
        
        const { path: filePath, mimetype } = req.file;
        console.log(`\n📎 Procesando archivo: ${req.file.originalname}`);
        
        // 1. OCR
        const ocrResult = await ocrService.processFile(filePath, mimetype);
        
        if (!ocrResult.success) {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            return res.status(422).json({
                success: false,
                error: 'El sistema no pudo leer el contenido del archivo. Intenta con una imagen más clara.'
            });
        }
        
        // 2. Análisis (AI + Local)
        const localResults = parserService.parseInvoice(ocrResult.text);
        const groqResults = await aiService.analyzeInvoiceWithGroq(ocrResult.text);
        
        // Fusión
        const merged = {
            provider: groqResults?.provider || localResults.provider?.name || localResults.provider,
            customerName: groqResults?.customerName || localResults.customerName,
            amount: groqResults?.amount || localResults.amount,
            dueDate: groqResults?.dueDate || localResults.dueDate,
            barcode: groqResults?.barcode || localResults.barcode
        };

        const source = groqResults ? 'groq-ai' : 'local-hybrid';

        // Limpiar archivo temporal
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        // Respuesta estructurada
        res.json({
            success: true,
            processingTime: `${duration}s`,
            source: source,
            extracted: {
                amount: merged.amount,
                amountFormatted: merged.amount 
                    ? `$${Number(merged.amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                    : null,
                dueDate: merged.dueDate,
                dueDateFormatted: merged.dueDate ? merged.dueDate.split('-').reverse().join('/') : null,
                barcode: merged.barcode,
                provider: typeof merged.provider === 'string' ? { name: merged.provider } : merged.provider,
                customerName: merged.customerName || null
            }
        });
        
    } catch (error) {
        console.error('❌ Error en procesamiento de factura:', error);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ 
            success: false, 
            error: 'Ocurrió un error inesperado al procesar la factura. Por favor, intente nuevamente.' 
        });
    }
};
