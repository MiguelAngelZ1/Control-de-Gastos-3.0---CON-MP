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
 * ACTUALIZADO: Preferencia por códigos de 40-60 dígitos (Interbanking/PMC)
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
    
    if (cleaned.length > 65) {
        return { valid: false, reason: 'Código muy largo' };
    }
    
    // Determinar tipo de código
    let type = 'unknown';
    let priority = 0;
    
    // PRIORIDAD ALTA: Códigos de 40-60 dígitos (Interbanking/PMC)
    if (cleaned.length >= 40 && cleaned.length <= 60) {
        type = 'interbanking_pmc';
        priority = 100; // Máxima prioridad
    }
    // Código de barras estándar de servicios (23-39 dígitos)
    else if (cleaned.length >= 23 && cleaned.length < 40) {
        type = 'service_barcode';
        priority = 50;
    }
    // CBU (22 dígitos)
    else if (cleaned.length === 22) {
        type = 'cbu';
        priority = 30;
    }
    // Código de pago electrónico corto (19-22 dígitos)
    else if (cleaned.length >= 19 && cleaned.length < 23) {
        type = 'electronic_payment';
        priority = 40;
    }
    // Otros códigos numéricos
    else if (/^\d{10,}$/.test(cleaned)) {
        type = 'numeric_code';
        priority = 10;
    }
    
    return {
        valid: true,
        cleaned: cleaned,
        length: cleaned.length,
        type: type,
        priority: priority,
        isPreferred: cleaned.length >= 40 && cleaned.length <= 60
    };
}

/**
 * Extrae códigos de barras del texto OCR
 * ACTUALIZADO: Prioriza códigos de 40-60 dígitos
 * 
 * @param {string} ocrText - Texto del OCR
 * @returns {Array} Lista de códigos encontrados
 */
function extractBarcodesFromText(ocrText) {
    console.log('\n🔎 Buscando códigos de barras en texto OCR...');
    console.log('   🎯 Prioridad: códigos de 40-60 dígitos (Interbanking/PMC)');
    
    const codes = [];
    
    // Buscar secuencias largas de dígitos (15+ caracteres)
    const digitSequences = ocrText.match(/\d{15,}/g) || [];
    
    console.log(`   Secuencias numéricas encontradas: ${digitSequences.length}`);
    
    for (const sequence of digitSequences) {
        const validation = validateBarcode(sequence);
        
        if (validation.valid) {
            codes.push({
                code: validation.cleaned,
                length: validation.length,
                type: validation.type,
                priority: validation.priority,
                isPreferred: validation.isPreferred,
                source: 'ocr_text',
                confidence: calculateBarcodeConfidence(sequence, ocrText)
            });
            
            // Log especial para códigos preferidos
            if (validation.isPreferred) {
                console.log(`   ✅ Código preferido encontrado: ${validation.length} dígitos`);
            }
        }
    }
    
    // Buscar códigos separados por espacios que podrían ser un código de barras largo
    const spacedPattern = /(\d{4,8}[\s]+){5,}\d{4,8}/g;
    let match;
    while ((match = spacedPattern.exec(ocrText)) !== null) {
        const code = match[0].replace(/\s/g, '');
        const validation = validateBarcode(code);
        
        if (validation.valid && !codes.some(c => c.code === validation.cleaned)) {
            codes.push({
                code: validation.cleaned,
                length: validation.length,
                type: validation.type,
                priority: validation.priority,
                isPreferred: validation.isPreferred,
                source: 'ocr_spaced',
                wasSpaced: true,
                confidence: 0.85
            });
        }
    }
    
    // Ordenar por prioridad (códigos de 40-60 dígitos primero)
    codes.sort((a, b) => {
        // Primero por prioridad
        if (b.priority !== a.priority) return b.priority - a.priority;
        // Si igual prioridad, por longitud (más largo = mejor)
        return b.length - a.length;
    });
    
    console.log(`   Códigos válidos encontrados: ${codes.length}`);
    if (codes.length > 0 && codes[0].isPreferred) {
        console.log(`   🎯 Mejor candidato: ${codes[0].length} dígitos (PREFERIDO)`);
    }
    
    return codes;
}

/**
 * Calcula la confianza de un código de barras basado en contexto
 * ACTUALIZADO: Bonus extra para códigos de 40-60 dígitos
 */
function calculateBarcodeConfidence(code, fullText) {
    let confidence = 0.5;
    
    // BONUS GRANDE para códigos de 40-60 dígitos
    if (code.length >= 40 && code.length <= 60) {
        confidence += 0.35;
    } else if (code.length >= 30) {
        confidence += 0.15;
    }
    
    // Buscar si aparece cerca de palabras clave
    const codeIndex = fullText.indexOf(code);
    if (codeIndex !== -1) {
        const contextBefore = fullText.substring(Math.max(0, codeIndex - 100), codeIndex).toLowerCase();
        const contextAfter = fullText.substring(codeIndex, Math.min(fullText.length, codeIndex + code.length + 50)).toLowerCase();
        const context = contextBefore + contextAfter;
        
        // Palabras clave de alta prioridad
        if (context.includes('interbanking')) confidence += 0.2;
        if (context.includes('pmc') || context.includes('pagomiscuentas')) confidence += 0.2;
        if (context.includes('pago electrónico') || context.includes('pago electronico')) confidence += 0.15;
        if (context.includes('código de barras') || context.includes('codigo de barras')) confidence += 0.1;
        if (context.includes('pagar') || context.includes('pago')) confidence += 0.1;
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
