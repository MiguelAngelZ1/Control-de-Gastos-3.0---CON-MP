/**
 * ====================================
 * UTILS.JS - Utilidades de Extracción
 * Invoice OCR Processor
 * ====================================
 * Funciones para extraer datos específicos
 * del texto OCR de facturas.
 * 
 * LIMITACIONES REALES:
 * - Los patrones están optimizados para facturas argentinas
 * - La precisión depende de la calidad del escaneo
 * - Algunos formatos de factura pueden no ser reconocidos
 */

/**
 * Extrae posibles montos del texto
 * Busca patrones numéricos que parezcan valores monetarios
 * 
 * @param {string} text - Texto del OCR
 * @returns {Array} Lista de montos encontrados con contexto
 */
function extractAmounts(text) {
    const amounts = [];
    
    // Patrones para montos en formato argentino y otros
    const patterns = [
        // $1.234,56 o $ 1.234,56
        /\$\s*([\d]{1,3}(?:\.[\d]{3})*(?:,[\d]{2})?)/g,
        // 1.234,56 (sin símbolo, formato argentino)
        /(?:total|importe|monto|pagar|vencimiento)[:\s]*\$?\s*([\d]{1,3}(?:\.[\d]{3})*,[\d]{2})/gi,
        // $1234.56 (formato internacional)
        /\$\s*([\d]+\.[\d]{2})/g,
        // Números grandes que podrían ser montos
        /(?:total|importe|monto|pagar)[:\s]*\$?\s*([\d.,]+)/gi
    ];
    
    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            const rawValue = match[1] || match[0];
            const numericValue = parseArgentineNumber(rawValue);
            
            if (numericValue && numericValue > 0 && numericValue < 10000000) {
                // Buscar contexto alrededor del monto
                const startIndex = Math.max(0, match.index - 30);
                const endIndex = Math.min(text.length, match.index + match[0].length + 20);
                const context = text.substring(startIndex, endIndex).replace(/\s+/g, ' ').trim();
                
                amounts.push({
                    raw: match[0],
                    value: numericValue,
                    formatted: formatCurrency(numericValue),
                    context: context,
                    confidence: calculateAmountConfidence(context, numericValue)
                });
            }
        }
    }
    
    // Ordenar por confianza y eliminar duplicados
    const uniqueAmounts = removeDuplicateAmounts(amounts);
    return uniqueAmounts.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Extrae fechas del texto
 * Busca múltiples formatos de fecha
 * 
 * @param {string} text - Texto del OCR
 * @returns {Array} Lista de fechas encontradas
 */
function extractDates(text) {
    const dates = [];
    
    const patterns = [
        // DD/MM/YYYY o DD-MM-YYYY
        /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/g,
        // DD/MM/YY
        /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})/g,
        // "15 de Enero de 2024" o similar
        /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?(\d{4})/gi,
        // YYYY-MM-DD (ISO)
        /(\d{4})-(\d{2})-(\d{2})/g
    ];
    
    const monthNames = {
        'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4,
        'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8,
        'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
    };
    
    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            try {
                let day, month, year;
                
                if (match[2] && monthNames[match[2].toLowerCase()]) {
                    // Formato "15 de Enero de 2024"
                    day = parseInt(match[1]);
                    month = monthNames[match[2].toLowerCase()];
                    year = parseInt(match[3]);
                } else if (match[1].length === 4) {
                    // Formato ISO YYYY-MM-DD
                    year = parseInt(match[1]);
                    month = parseInt(match[2]);
                    day = parseInt(match[3]);
                } else {
                    // Formato DD/MM/YYYY o DD/MM/YY
                    day = parseInt(match[1]);
                    month = parseInt(match[2]);
                    year = parseInt(match[3]);
                    if (year < 100) year += 2000;
                }
                
                // Validar fecha
                if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2020 && year <= 2030) {
                    const date = new Date(year, month - 1, day);
                    
                    // Buscar contexto para determinar tipo de fecha
                    const startIndex = Math.max(0, match.index - 40);
                    const context = text.substring(startIndex, match.index).toLowerCase();
                    
                    let type = 'unknown';
                    if (context.includes('vencimiento') || context.includes('vence') || context.includes('vto')) {
                        type = 'due_date';
                    } else if (context.includes('emisión') || context.includes('emision') || context.includes('fecha')) {
                        type = 'issue_date';
                    }
                    
                    dates.push({
                        raw: match[0],
                        date: date.toISOString().split('T')[0],
                        formatted: `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`,
                        type: type,
                        context: context.trim().slice(-30)
                    });
                }
            } catch (e) {
                // Fecha inválida, ignorar
            }
        }
    }
    
    return removeDuplicateDates(dates);
}

/**
 * Extrae posibles códigos de barras o referencias del texto
 * 
 * @param {string} text - Texto del OCR
 * @returns {Array} Lista de códigos encontrados
 */
function extractCodes(text) {
    const codes = [];
    
    const patterns = [
        // Código de barras largo (servicios argentinos típicamente 23+ dígitos)
        /\b(\d{23,48})\b/g,
        // Código de pago electrónico
        /(?:código|codigo|cod|cód)[:\s]*(\d{10,})/gi,
        // Referencia de pago
        /(?:referencia|ref|nro)[:\s]*([A-Z0-9\-]{6,})/gi,
        // Número de factura
        /(?:factura|fact|nro|número)[:\s]*([A-Z]?\d{4,}[\-]?\d*)/gi,
        // CBU
        /(?:cbu)[:\s]*(\d{22})/gi
    ];
    
    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            const code = match[1];
            
            // Determinar tipo de código
            let type = 'reference';
            if (/^\d{22}$/.test(code)) {
                type = 'cbu';
            } else if (/^\d{23,}$/.test(code)) {
                type = 'barcode';
            } else if (/factura|fact/i.test(match[0])) {
                type = 'invoice_number';
            }
            
            codes.push({
                raw: match[0],
                code: code,
                type: type,
                length: code.length
            });
        }
    }
    
    return removeDuplicateCodes(codes);
}

/**
 * Extrae información del proveedor/empresa
 * 
 * @param {string} text - Texto del OCR
 * @returns {Object} Información del proveedor
 */
function extractProvider(text) {
    const providers = {
        'edenor': { name: 'Edenor', type: 'electricity' },
        'edesur': { name: 'Edesur', type: 'electricity' },
        'metrogas': { name: 'Metrogas', type: 'gas' },
        'naturgy': { name: 'Naturgy', type: 'gas' },
        'aysa': { name: 'AySA', type: 'water' },
        'telecom': { name: 'Telecom', type: 'telecom' },
        'telefonica': { name: 'Telefónica', type: 'telecom' },
        'movistar': { name: 'Movistar', type: 'telecom' },
        'claro': { name: 'Claro', type: 'telecom' },
        'personal': { name: 'Personal', type: 'telecom' },
        'fibertel': { name: 'Fibertel', type: 'internet' },
        'cablevision': { name: 'Cablevisión', type: 'cable' },
        'directv': { name: 'DirecTV', type: 'cable' },
        'netflix': { name: 'Netflix', type: 'streaming' },
        'spotify': { name: 'Spotify', type: 'streaming' }
    };
    
    const textLower = text.toLowerCase();
    
    for (const [key, value] of Object.entries(providers)) {
        if (textLower.includes(key)) {
            return value;
        }
    }
    
    // Intentar extraer CUIT
    const cuitMatch = text.match(/(?:cuit|c\.u\.i\.t\.?)[:\s]*(\d{2}[\-\s]?\d{8}[\-\s]?\d{1})/i);
    if (cuitMatch) {
        return {
            name: 'Desconocido',
            type: 'unknown',
            cuit: cuitMatch[1].replace(/[\-\s]/g, '')
        };
    }
    
    return null;
}

/**
 * Convierte número en formato argentino a float
 * Ej: "1.234,56" -> 1234.56
 */
function parseArgentineNumber(str) {
    if (!str) return null;
    
    // Limpiar el string
    let cleaned = str.toString().replace(/[^\d.,]/g, '');
    
    // Detectar formato
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    
    if (lastComma > lastDot) {
        // Formato argentino: 1.234,56
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (lastDot > lastComma) {
        // Formato internacional: 1,234.56
        cleaned = cleaned.replace(/,/g, '');
    }
    
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
}

/**
 * Formatea número como moneda argentina
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS'
    }).format(amount);
}

/**
 * Calcula confianza del monto basado en contexto
 */
function calculateAmountConfidence(context, value) {
    let confidence = 0.5;
    
    const contextLower = context.toLowerCase();
    
    // Palabras que aumentan confianza
    if (contextLower.includes('total')) confidence += 0.3;
    if (contextLower.includes('pagar')) confidence += 0.2;
    if (contextLower.includes('importe')) confidence += 0.15;
    if (contextLower.includes('monto')) confidence += 0.15;
    if (contextLower.includes('vencimiento')) confidence += 0.1;
    
    // Montos muy pequeños o muy grandes son menos probables
    if (value < 100) confidence -= 0.2;
    if (value > 100000) confidence -= 0.1;
    
    return Math.min(1, Math.max(0, confidence));
}

/**
 * Elimina montos duplicados
 */
function removeDuplicateAmounts(amounts) {
    const seen = new Set();
    return amounts.filter(a => {
        const key = a.value.toFixed(2);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * Elimina fechas duplicadas
 */
function removeDuplicateDates(dates) {
    const seen = new Set();
    return dates.filter(d => {
        if (seen.has(d.date)) return false;
        seen.add(d.date);
        return true;
    });
}

/**
 * Elimina códigos duplicados
 */
function removeDuplicateCodes(codes) {
    const seen = new Set();
    return codes.filter(c => {
        if (seen.has(c.code)) return false;
        seen.add(c.code);
        return true;
    });
}

/**
 * Analiza el texto completo y devuelve datos estructurados
 * 
 * @param {string} text - Texto del OCR
 * @returns {Object} Datos extraídos
 */
function analyzeInvoiceText(text) {
    console.log('\n📝 Analizando texto extraído...');
    console.log(`   Longitud del texto: ${text.length} caracteres`);
    
    const amounts = extractAmounts(text);
    const dates = extractDates(text);
    const codes = extractCodes(text);
    const provider = extractProvider(text);
    
    // Seleccionar el monto más probable (mayor confianza)
    const primaryAmount = amounts.length > 0 ? amounts[0] : null;
    
    // Seleccionar fecha de vencimiento o la más probable
    const dueDate = dates.find(d => d.type === 'due_date') || dates[0] || null;
    
    // Seleccionar código de barras si existe
    const barcode = codes.find(c => c.type === 'barcode') || null;
    
    console.log(`   Montos encontrados: ${amounts.length}`);
    console.log(`   Fechas encontradas: ${dates.length}`);
    console.log(`   Códigos encontrados: ${codes.length}`);
    console.log(`   Proveedor detectado: ${provider ? provider.name : 'No'}`);
    
    return {
        // Datos principales (mejor estimación)
        primary: {
            amount: primaryAmount ? primaryAmount.value : null,
            amountFormatted: primaryAmount ? primaryAmount.formatted : null,
            amountConfidence: primaryAmount ? primaryAmount.confidence : 0,
            dueDate: dueDate ? dueDate.date : null,
            dueDateFormatted: dueDate ? dueDate.formatted : null,
            barcode: barcode ? barcode.code : null,
            provider: provider
        },
        // Todos los datos encontrados (para selección manual)
        all: {
            amounts,
            dates,
            codes
        },
        // Metadatos
        meta: {
            textLength: text.length,
            hasAmount: amounts.length > 0,
            hasDate: dates.length > 0,
            hasBarcode: barcode !== null,
            hasProvider: provider !== null
        }
    };
}

module.exports = {
    extractAmounts,
    extractDates,
    extractCodes,
    extractProvider,
    analyzeInvoiceText,
    parseArgentineNumber,
    formatCurrency
};
