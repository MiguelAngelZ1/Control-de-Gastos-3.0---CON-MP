/**
 * ====================================
 * BARCODE.JS - Detector de Códigos de Barras
 * Invoice OCR Processor
 * ====================================
 * Intenta detectar códigos de barras en imágenes.
 * 
 * LIMITACIONES REALES:
 * - La detección de códigos de barras en imágenes de facturas es MUY difícil
 * - Los códigos de barras de servicios argentinos son especialmente problemáticos:
 *   - Son muy largos (40+ dígitos)
 *   - Suelen estar impresos en baja calidad
 *   - A menudo están distorsionados o borrosos
 * - La mayoría de las veces es más confiable extraer el código del texto OCR
 * - Las librerías de JavaScript para códigos de barras tienen limitaciones
 * 
 * ESTRATEGIA:
 * - Primero intentamos con el texto OCR (más confiable)
 * - Como fallback, intentamos decodificar la imagen directamente
 */

const Jimp = require('jimp');

/**
 * Valida si un string podría ser un código de barras de servicio argentino
 * 
 * Los códigos de barras de servicios argentinos típicamente:
 * - Tienen entre 23 y 48 dígitos
 * - Son solo numéricos
 * - Pueden tener estructura específica según el servicio
 * 
 * @param {string} code - Código a validar
 * @returns {Object} Resultado de validación
 */
function validateBarcode(code) {
    if (!code || typeof code !== 'string') {
        return { valid: false, reason: 'Código vacío o inválido' };
    }
    
    // Limpiar espacios y caracteres no numéricos
    const cleaned = code.replace(/\D/g, '');
    
    if (cleaned.length < 10) {
        return { valid: false, reason: 'Código muy corto' };
    }
    
    if (cleaned.length > 60) {
        return { valid: false, reason: 'Código muy largo' };
    }
    
    // Patrones conocidos de códigos de barras argentinos
    const patterns = {
        // Código de barras de facturas de servicios (típicamente 23-48 dígitos)
        servicio: /^\d{23,48}$/,
        // Código de pago electrónico
        pagoElectronico: /^\d{19,23}$/,
        // CBU
        cbu: /^\d{22}$/
    };
    
    let type = 'unknown';
    
    if (patterns.cbu.test(cleaned)) {
        type = 'cbu';
    } else if (patterns.servicio.test(cleaned)) {
        type = 'service_barcode';
    } else if (patterns.pagoElectronico.test(cleaned)) {
        type = 'electronic_payment';
    } else if (/^\d{10,}$/.test(cleaned)) {
        type = 'numeric_code';
    }
    
    return {
        valid: true,
        cleaned: cleaned,
        length: cleaned.length,
        type: type
    };
}

/**
 * Extrae códigos de barras del texto OCR
 * Esta es la forma más confiable para facturas argentinas
 * 
 * @param {string} ocrText - Texto del OCR
 * @returns {Array} Lista de códigos encontrados
 */
function extractBarcodesFromText(ocrText) {
    console.log('\n🔎 Buscando códigos de barras en texto OCR...');
    
    const codes = [];
    
    // Buscar secuencias largas de dígitos
    const digitSequences = ocrText.match(/\d{15,}/g) || [];
    
    console.log(`   Secuencias numéricas encontradas: ${digitSequences.length}`);
    
    for (const sequence of digitSequences) {
        const validation = validateBarcode(sequence);
        
        if (validation.valid) {
            codes.push({
                code: validation.cleaned,
                length: validation.length,
                type: validation.type,
                source: 'ocr_text',
                confidence: calculateBarcodeConfidence(sequence, ocrText)
            });
        }
    }
    
    // Buscar patrones específicos con contexto
    const contextPatterns = [
        /(?:código|codigo|cód|cod)[\s:]+(\d{10,})/gi,
        /(?:barras?)[\s:]+(\d{10,})/gi,
        /(?:pago|pagar)[\s:]+(\d{10,})/gi
    ];
    
    for (const pattern of contextPatterns) {
        let match;
        while ((match = pattern.exec(ocrText)) !== null) {
            const validation = validateBarcode(match[1]);
            if (validation.valid && !codes.some(c => c.code === validation.cleaned)) {
                codes.push({
                    code: validation.cleaned,
                    length: validation.length,
                    type: validation.type,
                    source: 'ocr_context',
                    confidence: 0.8
                });
            }
        }
    }
    
    // Ordenar por longitud (códigos más largos primero, suelen ser los de pago)
    codes.sort((a, b) => b.length - a.length);
    
    console.log(`   Códigos válidos encontrados: ${codes.length}`);
    
    return codes;
}

/**
 * Calcula la confianza de un código de barras basado en contexto
 */
function calculateBarcodeConfidence(code, fullText) {
    let confidence = 0.5;
    
    // Código más largo = más probable que sea el de pago
    if (code.length >= 30) confidence += 0.2;
    if (code.length >= 40) confidence += 0.1;
    
    // Buscar si aparece cerca de palabras clave
    const codeIndex = fullText.indexOf(code);
    if (codeIndex !== -1) {
        const context = fullText.substring(Math.max(0, codeIndex - 50), codeIndex).toLowerCase();
        
        if (context.includes('pagar') || context.includes('pago')) confidence += 0.2;
        if (context.includes('código') || context.includes('codigo')) confidence += 0.1;
        if (context.includes('barras')) confidence += 0.15;
    }
    
    return Math.min(1, confidence);
}

/**
 * Intenta decodificar códigos de barras directamente de una imagen
 * NOTA: Esto tiene limitaciones significativas con facturas reales
 * 
 * @param {string} imagePath - Ruta a la imagen
 * @returns {Promise<Array>} Códigos detectados
 */
async function scanBarcodeFromImage(imagePath) {
    console.log('\n📷 Intentando escanear código de barras de imagen...');
    console.log('   ⚠️ Nota: Esta funcionalidad tiene limitaciones con facturas reales');
    
    try {
        // Cargar imagen con Jimp
        const image = await Jimp.read(imagePath);
        
        // Preprocesar para mejorar detección
        image.greyscale().contrast(0.5);
        
        // Por ahora, retornamos vacío ya que la decodificación real
        // requeriría una librería de código de barras más pesada
        // como @zxing/library con canvas, que no funciona bien en Node.js puro
        
        console.log('   ℹ️ Escaneo directo no disponible en esta versión');
        console.log('   ➡️ Usando extracción de texto OCR como alternativa');
        
        return [];
        
    } catch (error) {
        console.error('   ❌ Error escaneando imagen:', error.message);
        return [];
    }
}

/**
 * Función principal para obtener códigos de barras
 * Combina múltiples estrategias
 * 
 * @param {string} ocrText - Texto del OCR
 * @param {string} imagePath - Ruta a la imagen (opcional)
 * @returns {Promise<Object>} Resultado con códigos encontrados
 */
async function findBarcodes(ocrText, imagePath = null) {
    console.log('\n' + '='.repeat(50));
    console.log('🔍 BÚSQUEDA DE CÓDIGOS DE BARRAS');
    console.log('='.repeat(50));
    
    // Estrategia 1: Extraer del texto OCR (más confiable)
    const textCodes = extractBarcodesFromText(ocrText);
    
    // Estrategia 2: Escanear imagen directamente (fallback)
    let imageCodes = [];
    if (imagePath && textCodes.length === 0) {
        imageCodes = await scanBarcodeFromImage(imagePath);
    }
    
    // Combinar resultados
    const allCodes = [...textCodes, ...imageCodes];
    
    // Seleccionar el mejor código (probablemente el de pago)
    const bestCode = allCodes.find(c => c.type === 'service_barcode') || 
                     allCodes.find(c => c.length >= 20) ||
                     allCodes[0] || null;
    
    console.log('\n📊 Resumen de códigos:');
    console.log(`   Total encontrados: ${allCodes.length}`);
    console.log(`   Mejor candidato: ${bestCode ? `${bestCode.code.substring(0, 15)}... (${bestCode.length} dígitos)` : 'Ninguno'}`);
    
    return {
        found: allCodes.length > 0,
        best: bestCode,
        all: allCodes
    };
}

module.exports = {
    findBarcodes,
    extractBarcodesFromText,
    scanBarcodeFromImage,
    validateBarcode
};
