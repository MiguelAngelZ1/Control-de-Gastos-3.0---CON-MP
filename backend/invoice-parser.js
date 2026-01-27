/**
 * ====================================
 * INVOICE-PARSER.JS - Parser Inteligente de Facturas
 * ====================================
 * 
 * PROBLEMA RESUELTO:
 * El OCR extrae TODO el texto, pero las facturas tienen muchos
 * números, montos y fechas. Este parser usa CONTEXTO y REGLAS
 * para identificar los datos correctos, como lo hacen:
 * - Mercado Pago
 * - PagoFácil
 * - Rapipago
 * 
 * ESTRATEGIA:
 * 1. Detectar el tipo de factura/proveedor
 * 2. Buscar ZONAS de pago (áreas donde están los datos importantes)
 * 3. Usar CONTEXTO (palabras clave cerca de los valores)
 * 4. Aplicar REGLAS específicas por proveedor
 * 5. Validar estructura de códigos de barras
 */

// ==========================================
// CONFIGURACIÓN DE PROVEEDORES CONOCIDOS
// ==========================================

const PROVIDERS = {
    // Electricidad
    edenor: {
        name: 'Edenor',
        type: 'electricity',
        patterns: ['edenor', 'empresa distribuidora norte'],
        barcodePrefix: ['2', '3'],
        barcodeLength: [23, 40, 44],
        amountKeywords: ['total a pagar', 'importe', 'total factura'],
        dueDateKeywords: ['vencimiento', 'vto', 'fecha límite']
    },
    edesur: {
        name: 'Edesur',
        type: 'electricity',
        patterns: ['edesur', 'empresa distribuidora sur'],
        barcodePrefix: ['2', '3'],
        barcodeLength: [23, 40, 44],
        amountKeywords: ['total a pagar', 'importe a pagar'],
        dueDateKeywords: ['vencimiento', '1er vencimiento', '2do vencimiento']
    },
    
    // Gas
    metrogas: {
        name: 'Metrogas',
        type: 'gas',
        patterns: ['metrogas'],
        barcodePrefix: ['2'],
        barcodeLength: [23, 44],
        amountKeywords: ['total a pagar', 'importe'],
        dueDateKeywords: ['vencimiento', 'vto']
    },
    naturgy: {
        name: 'Naturgy',
        type: 'gas',
        patterns: ['naturgy', 'gas natural'],
        barcodePrefix: ['2'],
        barcodeLength: [23, 44],
        amountKeywords: ['total', 'importe a pagar'],
        dueDateKeywords: ['vencimiento']
    },
    camuzzi: {
        name: 'Camuzzi Gas',
        type: 'gas',
        patterns: ['camuzzi'],
        barcodePrefix: ['2'],
        barcodeLength: [23, 44],
        amountKeywords: ['total a pagar'],
        dueDateKeywords: ['vencimiento']
    },
    
    // Agua
    aysa: {
        name: 'AySA',
        type: 'water',
        patterns: ['aysa', 'agua y saneamientos argentinos'],
        barcodePrefix: ['2'],
        barcodeLength: [23, 44],
        amountKeywords: ['total', 'importe a pagar'],
        dueDateKeywords: ['vencimiento', 'vto']
    },
    
    // Telecomunicaciones
    telecom: {
        name: 'Telecom',
        type: 'telecom',
        patterns: ['telecom', 'personal', 'flow'],
        barcodePrefix: [],
        barcodeLength: [23, 30, 44],
        amountKeywords: ['total a pagar', 'total factura', 'importe'],
        dueDateKeywords: ['vencimiento', 'fecha de vencimiento']
    },
    movistar: {
        name: 'Movistar',
        type: 'telecom',
        patterns: ['movistar', 'telefónica', 'telefonica'],
        barcodePrefix: [],
        barcodeLength: [23, 44],
        amountKeywords: ['total a pagar', 'importe a pagar'],
        dueDateKeywords: ['vencimiento', 'vence']
    },
    claro: {
        name: 'Claro',
        type: 'telecom',
        patterns: ['claro', 'amx argentina'],
        barcodePrefix: [],
        barcodeLength: [23, 44],
        amountKeywords: ['total', 'monto a pagar'],
        dueDateKeywords: ['vencimiento']
    },
    
    // Internet/Cable
    fibertel: {
        name: 'Fibertel',
        type: 'internet',
        patterns: ['fibertel', 'cablevision', 'cablevisión'],
        barcodePrefix: [],
        barcodeLength: [23, 44],
        amountKeywords: ['total a pagar', 'importe'],
        dueDateKeywords: ['vencimiento']
    },
    telecentro: {
        name: 'Telecentro',
        type: 'internet',
        patterns: ['telecentro'],
        barcodePrefix: ['03', '32'],
        barcodeLength: [23, 26, 44],
        amountKeywords: ['total', 'importe', 'pagar'],
        dueDateKeywords: ['vencimiento', 'vto']
    },
    directv: {
        name: 'DirecTV',
        type: 'cable',
        patterns: ['directv', 'direct tv'],
        barcodePrefix: [],
        barcodeLength: [23, 44],
        amountKeywords: ['total a pagar'],
        dueDateKeywords: ['vencimiento']
    },
    
    // Seguros
    seguros: {
        name: 'Seguro',
        type: 'insurance',
        patterns: ['seguro', 'póliza', 'poliza', 'aseguradora'],
        barcodePrefix: [],
        barcodeLength: [23, 44],
        amountKeywords: ['prima', 'total a pagar', 'importe'],
        dueDateKeywords: ['vencimiento', 'vigencia']
    }
};

// ==========================================
// PALABRAS CLAVE POR TIPO DE DATO
// ==========================================

// Palabras que INDICAN que el monto cercano es el TOTAL A PAGAR
const AMOUNT_CONTEXT_POSITIVE = [
    // Máxima prioridad - son casi seguros
    { phrase: 'total a pagar', weight: 100 },
    { phrase: 'importe a pagar', weight: 100 },
    { phrase: 'monto a pagar', weight: 100 },
    { phrase: 'debe abonar', weight: 95 },
    { phrase: 'total factura', weight: 90 },
    
    // Alta prioridad
    { phrase: 'total', weight: 70 },
    { phrase: 'importe total', weight: 80 },
    { phrase: 'pagar', weight: 60 },
    { phrase: 'abonar', weight: 60 },
    
    // Media prioridad (pueden ser subtotales)
    { phrase: 'importe', weight: 40 },
    { phrase: 'monto', weight: 40 },
    { phrase: 'saldo', weight: 35 },
];

// Palabras que INDICAN que el monto cercano NO es el total
const AMOUNT_CONTEXT_NEGATIVE = [
    { phrase: 'iva', weight: -80 },
    { phrase: 'impuesto', weight: -70 },
    { phrase: 'cargo fijo', weight: -60 },
    { phrase: 'consumo', weight: -50 },
    { phrase: 'subtotal', weight: -70 },
    { phrase: 'descuento', weight: -60 },
    { phrase: 'bonificación', weight: -60 },
    { phrase: 'interés', weight: -50 },
    { phrase: 'recargo', weight: -40 },
    { phrase: 'anterior', weight: -50 },
    { phrase: 'saldo anterior', weight: -80 },
    { phrase: 'pago anterior', weight: -80 },
    { phrase: 'período anterior', weight: -70 },
    { phrase: 'factura anterior', weight: -80 },
    { phrase: 'cuit', weight: -90 },
    { phrase: 'cuil', weight: -90 },
    { phrase: 'dni', weight: -90 },
    { phrase: 'cliente', weight: -60 },
    { phrase: 'cuenta', weight: -50 },
    { phrase: 'número de cliente', weight: -90 },
    { phrase: 'nro cliente', weight: -90 },
    { phrase: 'kwh', weight: -80 },
    { phrase: 'm3', weight: -80 },
    { phrase: 'lectura', weight: -70 },
];

// Palabras que INDICAN fecha de vencimiento
const DATE_CONTEXT_POSITIVE = [
    { phrase: 'vencimiento', weight: 100 },
    { phrase: 'vto', weight: 100 },
    { phrase: 'fecha límite', weight: 95 },
    { phrase: 'fecha limite', weight: 95 },
    { phrase: 'vence', weight: 90 },
    { phrase: 'pagar antes', weight: 85 },
    { phrase: '1er vencimiento', weight: 100 },
    { phrase: '1° vencimiento', weight: 100 },
    { phrase: 'primer vencimiento', weight: 100 },
    { phrase: '2do vencimiento', weight: 80 },
    { phrase: '2° vencimiento', weight: 80 },
    { phrase: 'segundo vencimiento', weight: 80 },
];

// Palabras que INDICAN que la fecha NO es de vencimiento
const DATE_CONTEXT_NEGATIVE = [
    { phrase: 'emisión', weight: -90 },
    { phrase: 'emision', weight: -90 },
    { phrase: 'fecha factura', weight: -80 },
    { phrase: 'período', weight: -70 },
    { phrase: 'periodo', weight: -70 },
    { phrase: 'lectura', weight: -80 },
    { phrase: 'desde', weight: -60 },
    { phrase: 'hasta', weight: -40 },
    { phrase: 'nacimiento', weight: -100 },
    { phrase: 'alta', weight: -70 },
];

// ==========================================
// CLASE PRINCIPAL DEL PARSER
// ==========================================

class InvoiceParser {
    constructor(ocrText) {
        this.originalText = ocrText;
        this.text = this.normalizeText(ocrText);
        this.lines = this.text.split('\n').filter(l => l.trim());
        this.provider = null;
        this.results = {
            amount: null,
            dueDate: null,
            barcode: null,
            provider: null,
            confidence: {},
            alternatives: {
                amounts: [],
                dates: [],
                barcodes: []
            },
            debug: []
        };
    }

    /**
     * Normaliza el texto para procesamiento
     */
    normalizeText(text) {
        return text
            .toLowerCase()
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/\t/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/\n +/g, '\n')
            .replace(/ +\n/g, '\n');
    }

    /**
     * Log de debug
     */
    log(message) {
        this.results.debug.push(message);
        console.log(`   [Parser] ${message}`);
    }

    /**
     * Ejecuta el análisis completo
     */
    parse() {
        console.log('\n' + '═'.repeat(60));
        console.log('🔍 INVOICE PARSER - Análisis Inteligente');
        console.log('═'.repeat(60));

        // Paso 1: Detectar proveedor
        this.detectProvider();

        // Paso 2: Extraer todos los candidatos
        const allAmounts = this.extractAllAmounts();
        const allDates = this.extractAllDates();
        const allBarcodes = this.extractAllBarcodes();

        this.log(`Candidatos encontrados: ${allAmounts.length} montos, ${allDates.length} fechas, ${allBarcodes.length} códigos`);

        // Paso 3: Analizar contexto y asignar scores
        const scoredAmounts = this.scoreAmounts(allAmounts);
        const scoredDates = this.scoreDates(allDates);
        const scoredBarcodes = this.scoreBarcodes(allBarcodes);

        // Paso 4: Seleccionar los mejores candidatos
        this.selectBestAmount(scoredAmounts);
        this.selectBestDate(scoredDates);
        this.selectBestBarcode(scoredBarcodes);

        // Paso 5: Validación cruzada
        this.crossValidate();

        console.log('\n📊 RESULTADOS FINALES:');
        console.log(`   Monto: ${this.results.amount ? '$' + this.results.amount.toFixed(2) : 'No detectado'} (confianza: ${this.results.confidence.amount || 0}%)`);
        console.log(`   Fecha: ${this.results.dueDate || 'No detectada'} (confianza: ${this.results.confidence.date || 0}%)`);
        console.log(`   Código: ${this.results.barcode ? this.results.barcode.substring(0, 20) + '...' : 'No detectado'} (confianza: ${this.results.confidence.barcode || 0}%)`);
        console.log('═'.repeat(60) + '\n');

        return this.results;
    }

    /**
     * PASO 1: Detectar el proveedor de la factura
     */
    detectProvider() {
        this.log('Detectando proveedor...');

        for (const [key, config] of Object.entries(PROVIDERS)) {
            for (const pattern of config.patterns) {
                if (this.text.includes(pattern)) {
                    this.provider = { key, ...config };
                    this.results.provider = {
                        id: key,
                        name: config.name,
                        type: config.type
                    };
                    this.log(`✓ Proveedor detectado: ${config.name} (${config.type})`);
                    return;
                }
            }
        }

        this.log('⚠ Proveedor no identificado, usando reglas genéricas');
    }

    /**
     * PASO 2A: Extraer TODOS los posibles montos
     * VERSIÓN MEJORADA - Más patrones y mejor logging
     */
    extractAllAmounts() {
        const amounts = [];
        
        this.log('Buscando montos en el texto...');
        
        // ESTRATEGIA 1: Buscar montos con contexto de palabras clave
        // Esto es más confiable porque busca montos CERCA de palabras relevantes
        const contextPatterns = [
            // "Total: $1.234,56" o "Total $1234,56" o "Total: 1.234,56"
            /(?:total|importe|monto|pagar|abonar|debe|deuda|saldo)[:\s]*\$?\s*([\d]{1,3}(?:[.,][\d]{3})*[.,][\d]{2})/gi,
            // "$1.234,56" después de dos puntos o igual
            /[=:]\s*\$?\s*([\d]{1,3}(?:[.,][\d]{3})*[.,][\d]{2})/g,
            // Monto al final de línea (común en facturas)
            /\$\s*([\d]{1,3}(?:[.,][\d]{3})*[.,][\d]{2})\s*$/gm,
        ];

        // ESTRATEGIA 2: Patrones generales de montos
        const generalPatterns = [
            // $1.234,56 o $ 1.234,56 (formato argentino con punto de miles)
            /\$\s*([\d]{1,3}(?:\.[\d]{3})+,[\d]{2})/g,
            // $1234,56 o $ 1234,56 (sin punto de miles)
            /\$\s*([\d]+,[\d]{2})/g,
            // $1,234.56 (formato internacional)
            /\$\s*([\d]{1,3}(?:,[\d]{3})*\.[\d]{2})/g,
            // $1234.56 (internacional simple)
            /\$\s*([\d]+\.[\d]{2})/g,
            // 1.234,56 sin símbolo (formato argentino)
            /(?:^|[^\d])([\d]{1,3}\.[\d]{3},[\d]{2})(?:[^\d]|$)/g,
            // 1234,56 sin símbolo ni punto de miles
            /(?:^|[^\d\.])([\d]{4,},[\d]{2})(?:[^\d]|$)/g,
            // ARS 1.234,56
            /ARS\s*([\d]{1,3}(?:[.,][\d]{3})*[.,][\d]{2})/gi,
        ];

        const allPatterns = [...contextPatterns, ...generalPatterns];
        let patternIndex = 0;

        for (const pattern of allPatterns) {
            let match;
            const regex = new RegExp(pattern.source, pattern.flags);
            
            while ((match = regex.exec(this.text)) !== null) {
                const rawValue = match[1] || match[0];
                const numericValue = this.parseAmount(rawValue);
                
                // Filtrar montos razonables para facturas de servicios
                // Bajamos el mínimo a $10 para capturar más casos
                if (numericValue >= 10 && numericValue <= 1000000) {
                    const position = match.index;
                    const context = this.getContext(position, 100);
                    
                    // Verificar que no sea un número de teléfono, CUIT, etc.
                    if (!this.looksLikeNonAmount(rawValue, context)) {
                        amounts.push({
                            value: numericValue,
                            raw: match[0],
                            position,
                            context,
                            line: this.getLineNumber(position),
                            patternUsed: patternIndex
                        });
                        
                        this.log(`  Monto candidato: $${numericValue.toFixed(2)} [${match[0]}]`);
                    }
                }
            }
            patternIndex++;
        }

        // ESTRATEGIA 3: Buscar específicamente en líneas con palabras clave
        const lines = this.originalText.split('\n');
        lines.forEach((line, lineIndex) => {
            const lineLower = line.toLowerCase();
            
            // Si la línea contiene palabras clave de total
            if (lineLower.includes('total') || 
                lineLower.includes('pagar') || 
                lineLower.includes('importe') ||
                lineLower.includes('deuda')) {
                
                // Buscar cualquier número que parezca monto en esta línea
                const numberMatches = line.match(/[\d]{1,3}(?:[.,][\d]{3})*[.,][\d]{2}/g);
                if (numberMatches) {
                    numberMatches.forEach(numStr => {
                        const value = this.parseAmount(numStr);
                        if (value >= 10 && value <= 1000000) {
                            // Verificar que no esté ya agregado
                            if (!amounts.find(a => Math.abs(a.value - value) < 0.01)) {
                                amounts.push({
                                    value: value,
                                    raw: numStr,
                                    position: this.text.indexOf(numStr),
                                    context: line,
                                    line: lineIndex + 1,
                                    patternUsed: 'line-scan'
                                });
                                this.log(`  Monto en línea clave: $${value.toFixed(2)} [${line.substring(0, 50)}...]`);
                            }
                        }
                    });
                }
            }
        });

        // ESTRATEGIA 4: Buscar números "sueltos" que podrían ser montos
        // Útil para PDFs donde el formato es inconsistente
        const looseNumberPattern = /(?:^|[^\d])(\d{1,6}[.,]\d{2})(?:[^\d]|$)/g;
        let looseMatch;
        while ((looseMatch = looseNumberPattern.exec(this.text)) !== null) {
            const value = this.parseAmount(looseMatch[1]);
            // Solo considerar si es un monto razonable y no está duplicado
            if (value >= 100 && value <= 500000) {
                if (!amounts.find(a => Math.abs(a.value - value) < 0.01)) {
                    const position = looseMatch.index;
                    const context = this.getContext(position, 100);
                    
                    // Solo agregar si el contexto no es negativo
                    if (!this.looksLikeNonAmount(looseMatch[1], context)) {
                        amounts.push({
                            value: value,
                            raw: looseMatch[1],
                            position,
                            context,
                            line: this.getLineNumber(position),
                            patternUsed: 'loose-number'
                        });
                        this.log(`  Monto suelto encontrado: $${value.toFixed(2)}`);
                    }
                }
            }
        }

        this.log(`  Total montos candidatos: ${amounts.length}`);
        
        // Si no encontramos nada, mostrar TODO el texto para debug
        if (amounts.length === 0) {
            this.log('  ⚠️ DEBUG - No se encontraron montos. Texto completo:');
            this.log('  ════════════════════════════════════════');
            this.originalText.split('\n').forEach((line, i) => {
                if (line.trim()) {
                    this.log(`  ${(i+1).toString().padStart(3)}: ${line}`);
                }
            });
            this.log('  ════════════════════════════════════════');
            
            // Buscar CUALQUIER número en el texto
            const anyNumbers = this.originalText.match(/\d+[.,]?\d*/g);
            if (anyNumbers) {
                this.log(`  Números encontrados en bruto: ${anyNumbers.slice(0, 20).join(', ')}...`);
            }
        }

        // Eliminar duplicados
        return this.removeDuplicates(amounts, 'value');
    }

    /**
     * Verifica si un valor parece NO ser un monto
     */
    looksLikeNonAmount(raw, context) {
        const contextLower = context.toLowerCase();
        
        // Si está cerca de CUIT/CUIL, probablemente no es un monto
        if (contextLower.includes('cuit') || contextLower.includes('cuil')) {
            return true;
        }
        
        // Si está cerca de número de cliente/cuenta/factura
        if (contextLower.includes('n° cliente') || 
            contextLower.includes('nro cliente') ||
            contextLower.includes('número de cliente') ||
            contextLower.includes('n° cuenta') ||
            contextLower.includes('nro factura') ||
            contextLower.includes('n° factura')) {
            return true;
        }
        
        // Si parece un teléfono
        if (contextLower.includes('tel') || contextLower.includes('teléfono')) {
            return true;
        }
        
        return false;
    }

    /**
     * PASO 2B: Extraer TODAS las posibles fechas
     */
    extractAllDates() {
        const dates = [];
        
        const patterns = [
            // DD/MM/YYYY
            /(\d{1,2})\/(\d{1,2})\/(\d{4})/g,
            // DD-MM-YYYY
            /(\d{1,2})-(\d{1,2})-(\d{4})/g,
            // DD/MM/YY
            /(\d{1,2})\/(\d{1,2})\/(\d{2})(?!\d)/g,
            // "15 de Enero de 2024"
            /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?:\s+de(?:l)?)?\s+(\d{4})/gi,
        ];

        const monthNames = {
            'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4,
            'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8,
            'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
        };

        for (const pattern of patterns) {
            let match;
            const regex = new RegExp(pattern.source, pattern.flags);
            
            while ((match = regex.exec(this.text)) !== null) {
                try {
                    let day, month, year;
                    
                    if (monthNames[match[2]?.toLowerCase()]) {
                        day = parseInt(match[1]);
                        month = monthNames[match[2].toLowerCase()];
                        year = parseInt(match[3]);
                    } else {
                        day = parseInt(match[1]);
                        month = parseInt(match[2]);
                        year = parseInt(match[3]);
                        if (year < 100) year += 2000;
                    }

                    // Validar fecha
                    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2020 && year <= 2030) {
                        const date = new Date(year, month - 1, day);
                        
                        // Verificar que la fecha sea válida
                        if (date.getDate() === day) {
                            const position = match.index;
                            const context = this.getContext(position, 60);
                            
                            dates.push({
                                value: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
                                formatted: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`,
                                raw: match[0],
                                position,
                                context,
                                line: this.getLineNumber(position),
                                dateObj: date
                            });
                        }
                    }
                } catch (e) {
                    // Fecha inválida, ignorar
                }
            }
        }

        return this.removeDuplicates(dates, 'value');
    }

    /**
     * PASO 2C: Extraer TODOS los posibles códigos de barras
     */
    extractAllBarcodes() {
        const barcodes = [];
        
        // Buscar secuencias de dígitos de 20+ caracteres
        const pattern = /\b(\d{20,50})\b/g;
        let match;
        
        while ((match = pattern.exec(this.text)) !== null) {
            const code = match[1];
            const position = match.index;
            const context = this.getContext(position, 50);
            
            // Validar que no sea un número de teléfono, CUIT, etc.
            if (!this.isInvalidBarcode(code, context)) {
                barcodes.push({
                    value: code,
                    length: code.length,
                    position,
                    context,
                    line: this.getLineNumber(position)
                });
            }
        }

        // También buscar códigos separados por espacios que podrían ser un código de barras
        const spacedPattern = /\b(\d{4,6}[\s]){4,10}\d{4,6}\b/g;
        while ((match = spacedPattern.exec(this.text)) !== null) {
            const code = match[0].replace(/\s/g, '');
            if (code.length >= 20 && code.length <= 50) {
                const position = match.index;
                barcodes.push({
                    value: code,
                    length: code.length,
                    position,
                    context: this.getContext(position, 50),
                    line: this.getLineNumber(position),
                    wasSpaced: true
                });
            }
        }

        return this.removeDuplicates(barcodes, 'value');
    }

    /**
     * PASO 3A: Asignar scores a los montos basado en contexto
     */
    scoreAmounts(amounts) {
        return amounts.map(amount => {
            let score = 50; // Score base
            const context = amount.context.toLowerCase();
            const reasons = [];

            // Analizar contexto positivo
            for (const { phrase, weight } of AMOUNT_CONTEXT_POSITIVE) {
                if (context.includes(phrase)) {
                    score += weight;
                    reasons.push(`+${weight}: "${phrase}"`);
                }
            }

            // Analizar contexto negativo
            for (const { phrase, weight } of AMOUNT_CONTEXT_NEGATIVE) {
                if (context.includes(phrase)) {
                    score += weight; // weight es negativo
                    reasons.push(`${weight}: "${phrase}"`);
                }
            }

            // Bonus si el monto está en un rango típico de facturas de servicios
            if (amount.value >= 1000 && amount.value <= 50000) {
                score += 10;
                reasons.push('+10: rango típico');
            }

            // Bonus si está cerca del final del documento (donde suele estar el total)
            const relativePosition = amount.position / this.text.length;
            if (relativePosition > 0.5) {
                score += 15;
                reasons.push('+15: posición inferior');
            }

            // Penalizar si el monto es muy redondo (probablemente es un subtotal o concepto)
            if (amount.value % 100 === 0 && amount.value < 5000) {
                score -= 20;
                reasons.push('-20: monto redondo sospechoso');
            }

            this.log(`Monto $${amount.value.toFixed(2)} -> Score: ${score} [${reasons.join(', ')}]`);

            return {
                ...amount,
                score: Math.max(0, Math.min(100, score)),
                reasons
            };
        }).sort((a, b) => b.score - a.score);
    }

    /**
     * PASO 3B: Asignar scores a las fechas basado en contexto
     */
    scoreDates(dates) {
        const now = new Date();
        
        return dates.map(date => {
            let score = 50;
            const context = date.context.toLowerCase();
            const reasons = [];

            // Analizar contexto positivo
            for (const { phrase, weight } of DATE_CONTEXT_POSITIVE) {
                if (context.includes(phrase)) {
                    score += weight;
                    reasons.push(`+${weight}: "${phrase}"`);
                }
            }

            // Analizar contexto negativo
            for (const { phrase, weight } of DATE_CONTEXT_NEGATIVE) {
                if (context.includes(phrase)) {
                    score += weight;
                    reasons.push(`${weight}: "${phrase}"`);
                }
            }

            // La fecha de vencimiento debería ser futura o reciente
            const diffDays = (date.dateObj - now) / (1000 * 60 * 60 * 24);
            if (diffDays >= -30 && diffDays <= 60) {
                score += 20;
                reasons.push('+20: fecha en rango esperado');
            } else if (diffDays < -30) {
                score -= 30;
                reasons.push('-30: fecha muy pasada');
            }

            // Bonus si está en la primera mitad del documento
            const relativePosition = date.position / this.text.length;
            if (relativePosition < 0.5) {
                score += 10;
                reasons.push('+10: posición superior');
            }

            this.log(`Fecha ${date.formatted} -> Score: ${score} [${reasons.join(', ')}]`);

            return {
                ...date,
                score: Math.max(0, Math.min(100, score)),
                reasons
            };
        }).sort((a, b) => b.score - a.score);
    }

    /**
     * PASO 3C: Asignar scores a los códigos de barras
     */
    scoreBarcodes(barcodes) {
        return barcodes.map(barcode => {
            let score = 50;
            const context = barcode.context.toLowerCase();
            const reasons = [];

            // Verificar longitud válida para códigos de servicios argentinos
            const validLengths = [23, 30, 40, 44, 48, 56, 58]; // Agregados largos comunes
            if (validLengths.includes(barcode.length)) {
                score += 30;
                reasons.push(`+30: longitud válida (${barcode.length})`);
            }

            // PREFERENCIA FUERTE por códigos largos (Interbanking/PMC suelen ser >40)
            if (barcode.length > 40) {
                score += 50; // Mucho más peso a códigos largos
                reasons.push('+50: longitud extendida (>40)');
            }

            // Si tenemos proveedor, verificar que coincida
            if (this.provider && this.provider.barcodeLength) {
                if (this.provider.barcodeLength.includes(barcode.length)) {
                    score += 20;
                    reasons.push('+20: longitud coincide con proveedor');
                }
            }

            // Contexto positivo
            if (context.includes('código') || context.includes('codigo')) {
                score += 15;
                reasons.push('+15: contexto "código"');
            }
            if (context.includes('barras')) {
                score += 20;
                reasons.push('+20: contexto "barras"');
            }
            if (context.includes('pago') || context.includes('pagar')) {
                score += 25;
                reasons.push('+25: contexto "pago"');
            }

            // Penalizar si parece un número de cuenta o cliente
            if (context.includes('cuenta') || context.includes('cliente')) {
                score -= 40;
                reasons.push('-40: parece nro de cuenta/cliente');
            }

            // Validar checksum si es código de 23 dígitos (estándar argentino)
            if (barcode.length === 23) {
                // Los códigos de pago argentinos suelen empezar con ciertos prefijos
                const prefix = barcode.substring(0, 2);
                if (['02', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29'].includes(prefix)) {
                    score += 15;
                    reasons.push('+15: prefijo válido');
                }
            }

            this.log(`Código ${barcode.value.substring(0, 15)}... -> Score: ${score} [${reasons.join(', ')}]`);

            return {
                ...barcode,
                score: Math.max(0, Math.min(100, score)),
                reasons
            };
        }).sort((a, b) => b.score - a.score);
    }

    /**
     * PASO 4A: Seleccionar el mejor monto
     */
    selectBestAmount(scoredAmounts) {
        if (scoredAmounts.length === 0) {
            this.log('⚠ No se encontraron montos válidos');
            return;
        }

        const best = scoredAmounts[0];
        
        // Solo aceptar si el score es razonable
        if (best.score >= 40) {
            this.results.amount = best.value;
            this.results.confidence.amount = best.score;
            this.log(`✓ Monto seleccionado: $${best.value.toFixed(2)} (score: ${best.score})`);
        } else {
            this.log(`⚠ Mejor monto ($${best.value.toFixed(2)}) tiene score muy bajo (${best.score})`);
        }

        // Guardar alternativas
        this.results.alternatives.amounts = scoredAmounts.slice(0, 5).map(a => ({
            value: a.value,
            formatted: `$${a.value.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
            score: a.score,
            context: a.context.substring(0, 50)
        }));
    }

    /**
     * PASO 4B: Seleccionar la mejor fecha
     */
    selectBestDate(scoredDates) {
        if (scoredDates.length === 0) {
            this.log('⚠ No se encontraron fechas válidas');
            return;
        }

        const best = scoredDates[0];
        
        if (best.score >= 40) {
            this.results.dueDate = best.value;
            this.results.dueDateFormatted = best.formatted;
            this.results.confidence.date = best.score;
            this.log(`✓ Fecha seleccionada: ${best.formatted} (score: ${best.score})`);
        } else {
            this.log(`⚠ Mejor fecha (${best.formatted}) tiene score muy bajo (${best.score})`);
        }

        // Guardar alternativas
        this.results.alternatives.dates = scoredDates.slice(0, 5).map(d => ({
            value: d.value,
            formatted: d.formatted,
            score: d.score,
            context: d.context.substring(0, 50)
        }));
    }

    /**
     * PASO 4C: Seleccionar el mejor código de barras
     */
    selectBestBarcode(scoredBarcodes) {
        if (scoredBarcodes.length === 0) {
            this.log('⚠ No se encontraron códigos de barras válidos');
            return;
        }

        const best = scoredBarcodes[0];
        
        if (best.score >= 30) {
            this.results.barcode = best.value;
            this.results.barcodeLength = best.length;
            this.results.confidence.barcode = best.score;
            this.log(`✓ Código seleccionado: ${best.value.substring(0, 20)}... (${best.length} dígitos, score: ${best.score})`);
        } else {
            this.log(`⚠ Mejor código tiene score muy bajo (${best.score})`);
        }

        // Guardar alternativas
        this.results.alternatives.barcodes = scoredBarcodes.slice(0, 3).map(b => ({
            value: b.value,
            length: b.length,
            score: b.score
        }));
    }

    /**
     * PASO 5: Validación cruzada
     */
    crossValidate() {
        this.log('Ejecutando validación cruzada...');

        // Si tenemos código de barras de 23+ dígitos, podría contener el monto
        if (this.results.barcode && this.results.barcode.length >= 23 && this.results.amount) {
            // En algunos códigos, los dígitos 12-20 contienen el monto
            // Esto varía por proveedor, así que solo lo usamos como validación
            const possibleAmount = parseInt(this.results.barcode.substring(11, 19)) / 100;
            
            if (Math.abs(possibleAmount - this.results.amount) < 1) {
                this.log('✓ Validación cruzada: monto coincide con código de barras');
                this.results.confidence.amount = Math.min(100, this.results.confidence.amount + 10);
            }
        }
    }

    // ==========================================
    // UTILIDADES
    // ==========================================

    parseAmount(str) {
        if (!str) return 0;
        
        // Limpiar todo excepto dígitos, puntos y comas
        let cleaned = str.replace(/[^\d.,]/g, '');
        
        if (!cleaned) return 0;
        
        // Contar puntos y comas
        const commaCount = (cleaned.match(/,/g) || []).length;
        const dotCount = (cleaned.match(/\./g) || []).length;
        
        const lastComma = cleaned.lastIndexOf(',');
        const lastDot = cleaned.lastIndexOf('.');
        
        // Caso 1: Solo comas -> la última es decimal si hay 2 dígitos después
        if (dotCount === 0 && commaCount > 0) {
            const afterLastComma = cleaned.substring(lastComma + 1);
            if (afterLastComma.length === 2) {
                // Formato: 1234,56 o 1,234,56 (pero el último es decimal)
                cleaned = cleaned.substring(0, lastComma).replace(/,/g, '') + '.' + afterLastComma;
            } else {
                // Las comas son separadores de miles: 1,234,567
                cleaned = cleaned.replace(/,/g, '');
            }
        }
        // Caso 2: Solo puntos -> el último es decimal si hay 2 dígitos después
        else if (commaCount === 0 && dotCount > 0) {
            const afterLastDot = cleaned.substring(lastDot + 1);
            if (afterLastDot.length === 2) {
                // Formato: 1234.56 o 1.234.56 (pero el último es decimal)
                cleaned = cleaned.substring(0, lastDot).replace(/\./g, '') + '.' + afterLastDot;
            } else {
                // Los puntos son separadores de miles: 1.234.567
                cleaned = cleaned.replace(/\./g, '');
            }
        }
        // Caso 3: Hay ambos -> determinar cuál es decimal
        else if (commaCount > 0 && dotCount > 0) {
            if (lastComma > lastDot) {
                // Formato argentino: 1.234,56
                cleaned = cleaned.replace(/\./g, '').replace(',', '.');
            } else {
                // Formato internacional: 1,234.56
                cleaned = cleaned.replace(/,/g, '');
            }
        }
        
        const result = parseFloat(cleaned);
        return isNaN(result) ? 0 : result;
    }

    getContext(position, radius) {
        const start = Math.max(0, position - radius);
        const end = Math.min(this.text.length, position + radius);
        return this.text.substring(start, end).replace(/\n/g, ' ').trim();
    }

    getLineNumber(position) {
        return this.text.substring(0, position).split('\n').length;
    }

    removeDuplicates(array, key) {
        const seen = new Set();
        return array.filter(item => {
            const value = item[key];
            if (seen.has(value)) return false;
            seen.add(value);
            return true;
        });
    }

    isInvalidBarcode(code, context) {
        // Rechazar si parece CUIT/CUIL (11 dígitos con cierto patrón)
        if (code.length === 11) return true;
        
        // Rechazar si está en contexto de CUIT/CUIL/DNI
        if (context.includes('cuit') || context.includes('cuil') || context.includes('dni')) {
            return true;
        }
        
        // Rechazar si parece número de teléfono
        if (context.includes('tel') || context.includes('teléfono') || context.includes('telefono')) {
            return true;
        }

        // Rechazar si es número de cuenta
        if (context.includes('cuenta n') || context.includes('nro cuenta') || context.includes('número de cuenta')) {
            return true;
        }
        
        // Rechazar si es número de cliente
        if (context.includes('cliente n') || context.includes('nro cliente') || context.includes('número de cliente')) {
            return true;
        }

        return false;
    }
}

// ==========================================
// FUNCIÓN PRINCIPAL DE EXPORTACIÓN
// ==========================================

/**
 * Analiza el texto OCR de una factura y extrae los datos de pago
 * 
 * @param {string} ocrText - Texto extraído por OCR
 * @returns {Object} Datos extraídos con scores de confianza
 */
function parseInvoice(ocrText) {
    const parser = new InvoiceParser(ocrText);
    return parser.parse();
}

module.exports = {
    parseInvoice,
    InvoiceParser,
    PROVIDERS,
    AMOUNT_CONTEXT_POSITIVE,
    AMOUNT_CONTEXT_NEGATIVE,
    DATE_CONTEXT_POSITIVE,
    DATE_CONTEXT_NEGATIVE
};
