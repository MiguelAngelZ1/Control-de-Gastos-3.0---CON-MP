const Tesseract = require('tesseract.js');
const path = require('path');
const fs = require('fs');
const pdf = require('pdf-parse');

/**
 * Procesa un archivo (Imagen o PDF) usando Tesseract.js o pdf-parse
 */
async function processFile(filePath, mimetype) {
    try {
        console.log(`   ⚙️ Iniciando extracción de texto para: ${path.basename(filePath)} (${mimetype})`);
        
        let extractedText = '';
        let confidence = 0;

        // Si el archivo es PDF, usamos pdf-parse para extraer texto directamente
        if (mimetype === 'application/pdf' || path.extname(filePath).toLowerCase() === '.pdf') {
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdf(dataBuffer);
            extractedText = data.text;
            confidence = 100; // El texto PDF digital es 100% confiable
            
            // Si el PDF es escaneado (no tiene texto), informamos
            if (!extractedText || extractedText.trim().length < 10) {
                 console.warn('   ⚠️ El PDF parece ser una imagen escaneada. Intentando fallback (limitado)...');
                 // Aquí podríamos intentar convertir a imagen, pero requiere librerías adicionales
                 // Por ahora, lanzamos error descriptivo si está vacío
            }
        } else {
            // Si es imagen (JPG, PNG), usamos Tesseract.js
            const { data: { text, confidence: tConfidence } } = await Tesseract.recognize(
                filePath,
                'spa+eng',
                { 
                    logger: m => {
                        // Opcional: loguear progreso
                    }
                }
            );
            extractedText = text;
            confidence = tConfidence;
        }

        if (!extractedText || extractedText.trim().length === 0) {
            throw new Error('No se pudo extraer texto del archivo.');
        }

        return {
            success: true,
            text: extractedText,
            confidence: confidence
        };

    } catch (error) {
        console.error('   ❌ Error en Servicio de Extracción (OCR/PDF):', error.message);
        return { success: false, error: 'No se pudo procesar el contenido del comprobante. Asegúrese de que sea un PDF digital o una imagen clara.' };
    }
}

module.exports = { processFile };

