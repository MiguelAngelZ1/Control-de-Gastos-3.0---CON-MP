/**
 * ====================================
 * OCR.SERVICE.JS - Motor de Extracción de Texto
 * ====================================
 */

const Tesseract = require('tesseract.js');
const path = require('path');
const fs = require('fs');

/**
 * Procesa un archivo (Imagen o PDF) usando Tesseract.js
 */
async function processFile(filePath, mimetype) {
    try {
        console.log(`   ⚙️ Iniciando OCR para: ${path.basename(filePath)} (${mimetype})`);
        
        // Configuración de Tesseract.js para español e inglés
        const { data: { text, confidence } } = await Tesseract.recognize(
            filePath,
            'spa+eng',
            { 
                logger: m => {
                    if (m.status === 'recognizing text') {
                        // Opcional: loguear progreso
                    }
                }
            }
        );

        if (!text || text.trim().length === 0) {
            throw new Error('No se pudo extraer texto del archivo.');
        }

        return {
            success: true,
            text: text,
            confidence: confidence
        };

    } catch (error) {
        console.error('   ❌ Error en Motor OCR (Tesseract.js):', error.message);
        return { success: false, error: 'No se pudo procesar el contenido del comprobante.' };
    }
}

module.exports = { processFile };
