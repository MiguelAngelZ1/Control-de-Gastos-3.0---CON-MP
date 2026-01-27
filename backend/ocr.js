/**
 * ====================================
 * OCR.JS - Motor de OCR con Tesseract
 * Invoice OCR Processor
 * ====================================
 * Procesamiento real de imágenes y PDFs
 * usando Tesseract.js para OCR.
 * 
 * LIMITACIONES REALES DE TESSERACT:
 * - Funciona mejor con imágenes de alta resolución (300 DPI+)
 * - Texto muy pequeño o borroso puede no detectarse
 * - Tablas y layouts complejos pueden confundir el orden
 * - El reconocimiento de números es generalmente bueno
 * - Imágenes rotadas o con perspectiva dan malos resultados
 * - PDFs escaneados funcionan bien, PDFs digitales requieren conversión
 */

const Tesseract = require('tesseract.js');
const Jimp = require('jimp');
const path = require('path');
const fs = require('fs');

// Configuración de Tesseract
const TESSERACT_CONFIG = {
    lang: 'spa+eng', // Español + Inglés para mejor cobertura
    oem: Tesseract.OEM.LSTM_ONLY, // Usar red neuronal LSTM
    psm: Tesseract.PSM.AUTO // Detección automática de layout
};

/**
 * Preprocesa una imagen para mejorar el OCR
 * 
 * @param {string} imagePath - Ruta a la imagen
 * @returns {Promise<string>} Ruta a la imagen procesada
 */
async function preprocessImage(imagePath) {
    console.log('🔧 Preprocesando imagen...');
    
    try {
        const image = await Jimp.read(imagePath);
        
        // Obtener dimensiones originales
        const originalWidth = image.getWidth();
        const originalHeight = image.getHeight();
        console.log(`   Dimensiones originales: ${originalWidth}x${originalHeight}`);
        
        // Escalar si es muy pequeña (mejor OCR con imágenes grandes)
        if (originalWidth < 1000) {
            const scale = 1500 / originalWidth;
            image.scale(scale);
            console.log(`   Escalada a: ${image.getWidth()}x${image.getHeight()}`);
        }
        
        // Convertir a escala de grises
        image.greyscale();
        
        // Aumentar contraste
        image.contrast(0.3);
        
        // Normalizar (ajustar brillo/contraste automáticamente)
        image.normalize();
        
        // Guardar imagen procesada
        const processedPath = imagePath.replace(/\.[^.]+$/, '_processed.png');
        await image.writeAsync(processedPath);
        
        console.log('   ✅ Preprocesamiento completado');
        return processedPath;
        
    } catch (error) {
        console.error('   ⚠️ Error en preprocesamiento:', error.message);
        // Si falla el preprocesamiento, usar imagen original
        return imagePath;
    }
}

/**
 * Ejecuta OCR en una imagen
 * 
 * @param {string} imagePath - Ruta a la imagen
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<Object>} Resultado del OCR
 */
async function performOCR(imagePath, options = {}) {
    console.log('\n🔍 Iniciando OCR con Tesseract...');
    console.log(`   Archivo: ${path.basename(imagePath)}`);
    
    const startTime = Date.now();
    
    try {
        // Preprocesar imagen
        const processedPath = await preprocessImage(imagePath);
        
        console.log('   Ejecutando reconocimiento de texto...');
        console.log('   (Esto puede tomar 10-30 segundos para la primera imagen)');
        
        // Crear worker de Tesseract
        const worker = await Tesseract.createWorker('spa+eng', Tesseract.OEM.LSTM_ONLY, {
            logger: m => {
                if (m.status === 'recognizing text') {
                    const progress = Math.round(m.progress * 100);
                    if (progress % 20 === 0) {
                        console.log(`   Progreso: ${progress}%`);
                    }
                }
            }
        });
        
        // Configurar parámetros
        await worker.setParameters({
            tessedit_pageseg_mode: Tesseract.PSM.AUTO,
            preserve_interword_spaces: '1'
        });
        
        // Ejecutar OCR
        const result = await worker.recognize(processedPath);
        
        // Terminar worker
        await worker.terminate();
        
        // Limpiar archivo procesado si es diferente del original
        if (processedPath !== imagePath && fs.existsSync(processedPath)) {
            fs.unlinkSync(processedPath);
        }
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`   ✅ OCR completado en ${duration}s`);
        console.log(`   Confianza promedio: ${Math.round(result.data.confidence)}%`);
        
        return {
            success: true,
            text: result.data.text,
            confidence: result.data.confidence,
            words: result.data.words?.length || 0,
            lines: result.data.lines?.length || 0,
            duration: parseFloat(duration)
        };
        
    } catch (error) {
        console.error('   ❌ Error en OCR:', error.message);
        
        return {
            success: false,
            error: error.message,
            text: '',
            confidence: 0
        };
    }
}

/**
 * Extrae texto de un PDF usando pdf-parse
 * NOTA: Solo funciona con PDFs que tienen texto embebido (no escaneados)
 * 
 * @param {string} pdfPath - Ruta al PDF
 * @returns {Promise<Object>} Texto extraído
 */
async function extractTextFromPDF(pdfPath) {
    console.log('\n📄 Procesando PDF...');
    
    try {
        const pdfParse = require('pdf-parse');
        const dataBuffer = fs.readFileSync(pdfPath);
        const data = await pdfParse(dataBuffer);
        
        console.log(`   Páginas: ${data.numpages}`);
        console.log(`   Texto extraído: ${data.text.length} caracteres`);
        
        if (data.text.trim().length > 50) {
            // PDF tiene texto embebido
            console.log('   ✅ PDF con texto digital detectado');
            return {
                success: true,
                text: data.text,
                confidence: 95, // Alta confianza para texto digital
                pages: data.numpages,
                method: 'pdf-parse'
            };
        } else {
            // PDF probablemente es escaneado, necesita OCR
            console.log('   ⚠️ PDF parece ser escaneado, requiere OCR de imagen');
            return {
                success: false,
                error: 'PDF escaneado detectado. Por favor, suba una imagen de la factura.',
                text: '',
                confidence: 0
            };
        }
        
    } catch (error) {
        console.error('   ❌ Error procesando PDF:', error.message);
        return {
            success: false,
            error: `Error al procesar PDF: ${error.message}`,
            text: '',
            confidence: 0
        };
    }
}

/**
 * Procesa un archivo (imagen o PDF) y extrae texto
 * 
 * @param {string} filePath - Ruta al archivo
 * @param {string} mimeType - Tipo MIME del archivo
 * @returns {Promise<Object>} Resultado del procesamiento
 */
async function processFile(filePath, mimeType) {
    console.log('\n' + '='.repeat(50));
    console.log('📁 PROCESANDO ARCHIVO');
    console.log('='.repeat(50));
    console.log(`   Ruta: ${filePath}`);
    console.log(`   Tipo: ${mimeType}`);
    
    // Verificar que el archivo existe
    if (!fs.existsSync(filePath)) {
        return {
            success: false,
            error: 'Archivo no encontrado',
            text: '',
            confidence: 0
        };
    }
    
    const fileStats = fs.statSync(filePath);
    console.log(`   Tamaño: ${(fileStats.size / 1024).toFixed(2)} KB`);
    
    // Procesar según tipo
    if (mimeType === 'application/pdf') {
        return await extractTextFromPDF(filePath);
    } else if (mimeType.startsWith('image/')) {
        return await performOCR(filePath);
    } else {
        return {
            success: false,
            error: `Tipo de archivo no soportado: ${mimeType}`,
            text: '',
            confidence: 0
        };
    }
}

module.exports = {
    performOCR,
    extractTextFromPDF,
    processFile,
    preprocessImage
};
