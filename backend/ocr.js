/**
 * ====================================
 * OCR.JS - Motor de OCR Optimizado v3.0
 * ====================================
 */

const Tesseract = require('tesseract.js');
const Jimp = require('jimp');
const path = require('path');
const fs = require('fs');

/**
 * Preprocesamiento avanzado de imagen para facturas
 */
async function preprocessImage(imagePath) {
    try {
        const image = await Jimp.read(imagePath);
        
        // 1. Redimensionar si es necesario (mínimo 2000px de ancho para facturas)
        if (image.getWidth() < 2000) {
            image.resize(2000, Jimp.AUTO);
        }

        // 2. Escala de grises
        image.greyscale();

        // 3. Aumentar contraste y brillo para resaltar texto sobre fondos de color
        image.contrast(0.2);
        image.brightness(0.1);

        // 4. Binarización (Umbral adaptativo simulado)
        image.normalize();

        const processedPath = imagePath.replace(/\.[^.]+$/, '_proc.png');
        await image.writeAsync(processedPath);
        return processedPath;
    } catch (error) {
        console.error('Error en preprocesamiento:', error);
        return imagePath;
    }
}

/**
 * Ejecuta OCR con configuración optimizada para español y números
 */
async function performOCR(imagePath) {
    const processedPath = await preprocessImage(imagePath);
    
    const worker = await Tesseract.createWorker('spa+eng', 1, {
        logger: m => {
            if (m.status === 'recognizing text' && Math.round(m.progress * 100) % 25 === 0) {
                console.log(`   OCR Progreso: ${Math.round(m.progress * 100)}%`);
            }
        }
    });

    try {
        await worker.setParameters({
            tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÁÉÍÓÚÑáéíóúñ$/.,- :()',
            tessedit_pageseg_mode: Tesseract.PSM.AUTO,
        });

        const { data: { text, confidence } } = await worker.recognize(processedPath);
        await worker.terminate();

        // Limpiar archivo temporal
        if (processedPath !== imagePath) fs.unlinkSync(processedPath);

        return { success: true, text, confidence };
    } catch (error) {
        await worker.terminate();
        return { success: false, error: error.message };
    }
}

/**
 * Extracción de texto digital de PDF
 */
async function extractTextFromPDF(pdfPath) {
    try {
        const pdfParse = require('pdf-parse');
        const dataBuffer = fs.readFileSync(pdfPath);
        const data = await pdfParse(dataBuffer);
        
        if (data.text.trim().length > 20) {
            return { success: true, text: data.text, confidence: 100 };
        }
        return { success: false, error: 'PDF sin texto digital (escaneado)' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function processFile(filePath, mimeType) {
    if (mimeType === 'application/pdf') {
        const pdfResult = await extractTextFromPDF(filePath);
        if (pdfResult.success) return pdfResult;
        // Si el PDF es escaneado, en una implementación real deberíamos convertirlo a imagen
        // Por ahora devolvemos el error para simplificar
        return pdfResult;
    }
    return await performOCR(filePath);
}

module.exports = { processFile };
