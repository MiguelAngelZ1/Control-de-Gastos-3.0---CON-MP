/**
 * ====================================
 * INVOICE-PARSER.JS - Motor de Reglas Local
 * ====================================
 * Este módulo contiene la lógica de análisis basada en expresiones 
 * regulares y pesos contextuales exclusiva para facturas argentinas.
 * Sirve como respaldo robusto si la IA no está disponible y para 
 * validar datos técnicos como códigos de barras.
 * 
 * Optimizado para facturas de servicios de Argentina:
 * Extrae: Empresa, Titular, Monto, Vencimiento y Código de Barras.
 */

const { validateBarcode } = require('../utils/barcode');

const PROVIDERS = {
    // Servicios básicos de Argentina y solicitados por el usuario
    camuzzi: { name: 'Camuzzi', patterns: ['camuzzi', 'gas pampeana', 'gas del sur'], type: 'gas' },
    scpl: { name: 'SCPL', patterns: ['scpl', 'sociedad cooperativa popular limitada'], type: 'service' },
    metrogas: { name: 'Metrogas', patterns: ['metrogas'], type: 'gas' },
    naturgy: { name: 'Naturgy', patterns: ['naturgy', 'gas natural ban'], type: 'gas' },
    telecom: { name: 'Telecom / Personal', patterns: ['telecom', 'personal', 'flow'], type: 'telecom' },
    movistar: { name: 'Movistar', patterns: ['movistar', 'telefónica', 'telefonica'], type: 'telecom' },
    claro: { name: 'Claro', patterns: ['claro', 'amx argentina'], type: 'telecom' },
    aysa: { name: 'AySA', patterns: ['aysa', 'agua y saneamientos argentinos'], type: 'water' },
    edenor: { name: 'Edenor', patterns: ['edenor', 'empresa distribuidora norte'], type: 'electricity' },
    edesur: { name: 'Edesur', patterns: ['edesur', 'empresa distribuidora sur'], type: 'electricity' },
    telecentro: { name: 'Telecentro', patterns: ['telecentro'], type: 'internet' },
    fibertel: { name: 'Fibertel', patterns: ['fibertel', 'cablevision'], type: 'internet' },
    directv: { name: 'DirecTV', patterns: ['directv'], type: 'cable' },
    osde: { name: 'OSDE', patterns: ['osde'], type: 'health' },
    swiss_medical: { name: 'Swiss Medical', patterns: ['swiss medical'], type: 'health' },
    galeno: { name: 'Galeno', patterns: ['galeno'], type: 'health' }
};

class InvoiceParser {
    constructor(ocrText) {
        this.originalText = ocrText;
        this.text = this.normalizeText(ocrText);
        this.lines = ocrText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        this.results = {
            provider: null,
            customerName: null,
            amount: null,
            dueDate: null,
            barcode: null,
            confidence: { provider: 0, customerName: 0, amount: 0, date: 0, barcode: 0 },
            alternatives: { amounts: [], dates: [], barcodes: [] },
            debug: []
        };
    }

    normalizeText(text) {
        return text.toLowerCase()
            .replace(/\s+/g, ' ')
            .replace(/,/g, '.') 
            .replace(/\.\./g, '.');
    }

    log(msg) {
        this.results.debug.push(msg);
        console.log(`[Parser] ${msg}`);
    }

    parse() {
        this.log('Iniciando análisis local ultra-robusto v3.2...');
        
        this.detectProvider();
        this.extractCustomerName();
        this.extractAmount();
        this.extractDueDate();
        this.extractBarcode();

        return this.results;
    }

    /**
     * DETECCIÓN DE EMPRESA
     */
    detectProvider() {
        const textLower = this.originalText.toLowerCase();
        for (const [id, config] of Object.entries(PROVIDERS)) {
            for (const pattern of config.patterns) {
                if (textLower.includes(pattern)) {
                    this.results.provider = { id, name: config.name, type: config.type };
                    this.results.confidence.provider = 100;
                    this.log(`✓ Empresa detectada: ${config.name}`);
                    return;
                }
            }
        }
        
        // Búsqueda difusa en las primeras líneas (logos suelen estar arriba)
        for (let i = 0; i < Math.min(this.lines.length, 5); i++) {
            const line = this.lines[i].toLowerCase();
            for (const [id, config] of Object.entries(PROVIDERS)) {
                if (line.includes(id)) {
                    this.results.provider = { id, name: config.name, type: config.type };
                    this.results.confidence.provider = 80;
                    this.log(`✓ Empresa detectada (búsqueda difusa): ${config.name}`);
                    return;
                }
            }
        }
        this.log('⚠ Empresa no identificada');
    }

    /**
     * EXTRACCIÓN DE TITULAR (CLIENTE)
     */
    extractCustomerName() {
        this.log('Buscando nombre del titular del servicio...');
        
        const blacklist = [
            'EDENOR', 'EDESUR', 'METROGAS', 'NATURGY', 'AYSA', 'TELECOM', 'PERSONAL', 'FLOW', 
            'MOVISTAR', 'TELEFONICA', 'CLARO', 'FIBERTEL', 'TELECENTRO', 'DIRECTV',
            'S.A.', 'SA', 'INC', 'SRL', 'CUIT', 'CUIL', 'FACTURA', 'LIQUIDACION', 'CONSUMO',
            'TOTAL', 'PAGO', 'VENCE', 'VENCIMIENTO', 'CLIENTE', 'TITULAR', 'USUARIO',
            'SUMINISTRO', 'DIRECCION', 'DOMICILIO', 'ESTADO', 'PERIODO', 'MES', 'AÑO',
            'FECHA', 'EMISION', 'NUMERO', 'NRO', 'CALLE', 'PROVINCIA', 'LOCALIDAD', 'RESPONSABLE',
            'INSCRIPTO', 'MONOTRIBUTO', 'EXENTO', 'IVA'
        ];

        // 1. Buscar por etiquetas explícitas
        const namePatterns = [
            /(?:titular|cliente|usuario|señor\(a\)|sr\/a|nombre|pagador|apellido y nombre)[:\s]+([A-ZÁÉÍÓÚÑ\s]{5,45})/i,
            /(?:datos del cliente|datos del titular|destinatario)[:\s]*[\n\r]+([A-ZÁÉÍÓÚÑ\s]{5,45})/i,
            /([A-ZÁÉÍÓÚÑ\s]{5,45})[\n\r]+(?:cuit|cuil|dni)[:\s]*\d+/i
        ];

        for (const pattern of namePatterns) {
            const match = this.originalText.match(pattern);
            if (match && match[1]) {
                let name = match[1].trim().split('\n')[0].trim();
                name = name.split(/(?:CUIT|CUIL|DNI|NRO|N°|ID|COD)/i)[0].trim();

                if (this.isValidPersonName(name, blacklist)) {
                    this.results.customerName = name.toUpperCase();
                    this.results.confidence.customerName = 95;
                    this.log(`✓ Titular detectado por etiqueta: ${this.results.customerName}`);
                    return;
                }
            }
        }

        // 2. Buscar cerca de "Domicilio de Suministro" o "Lugar de Pago"
        const contextKeywords = ['suministro', 'domicilio', 'dirección', 'direccion'];
        for (let i = 0; i < Math.min(this.lines.length, 25); i++) {
            const line = this.lines[i].toLowerCase();
            if (contextKeywords.some(k => line.includes(k))) {
                // Mirar 2 líneas arriba y 2 abajo
                for (let j = Math.max(0, i - 2); j <= Math.min(this.lines.length - 1, i + 2); j++) {
                    const candidate = this.lines[j].trim();
                    if (this.isValidPersonName(candidate, blacklist)) {
                        this.results.customerName = candidate.toUpperCase();
                        this.results.confidence.customerName = 80;
                        this.log(`✓ Titular detectado por contexto geográfico: ${candidate}`);
                        return;
                    }
                }
            }
        }

        // 3. Fallback: Primera línea que parezca nombre
        for (let i = 0; i < Math.min(this.lines.length, 15); i++) {
            const line = this.lines[i].trim();
            if (this.isValidPersonName(line, blacklist)) {
                this.results.customerName = line.toUpperCase();
                this.results.confidence.customerName = 60;
                this.log(`✓ Titular probable (primera coincidencia): ${line}`);
                return;
            }
        }
    }

    isValidPersonName(name, blacklist) {
        if (name.length < 6 || name.length > 45) return false;
        if (/\d/.test(name)) return false;
        
        const upperName = name.toUpperCase();
        for (const word of blacklist) {
            if (upperName === word || upperName.startsWith(word + ' ') || upperName.endsWith(' ' + word)) return false;
        }
        
        // Debe tener al menos un espacio y no demasiados caracteres especiales
        const words = name.split(/\s+/);
        if (words.length < 2 || words.length > 5) return false;
        
        // Cada palabra debe tener al menos 2 letras
        return words.every(w => w.length >= 2);
    }

    /**
     * EXTRACCIÓN DE MONTO
     */
    extractAmount() {
        this.log('Buscando monto total...');
        const candidates = [];
        
        // Limpiar texto de puntos de miles para evitar confusiones (ej: 1.234.567,84 -> 1234567,84)
        // Eliminamos puntos que están seguidos de 3 dígitos y luego otro punto o una coma
        const cleanText = this.originalText
            .replace(/(\d)\.(\d{3})(?=\.\d{3})/g, '$1$2') // Miles intermedios
            .replace(/(\d)\.(\d{3})(?=[\s,])/g, '$1$2');  // Último grupo de miles
        
        // Patrones con contexto de alta prioridad
        const highPriorityRegex = /(?:total a pagar|total factura|importe total|monto total|total vencimiento|total liquidación|total liquidacion|pagar|saldo total|monto a pagar|importe neto|total de la factura)[:\s]*\$?\s*(\d+[\.,]\d{2})/gi;
        let match;
        while ((match = highPriorityRegex.exec(cleanText)) !== null) {
            const val = parseFloat(match[1].replace(',', '.'));
            if (val > 1) candidates.push({ val, weight: 100 });
        }

        // Patrones de prioridad media
        const midPriorityRegex = /(?:total|importe|monto|saldo|vencimiento)[:\s]*\$?\s*(\d+[\.,]\d{2})/gi;
        while ((match = midPriorityRegex.exec(cleanText)) !== null) {
            const val = parseFloat(match[1].replace(',', '.'));
            if (val > 1) candidates.push({ val, weight: 70 });
        }

        if (candidates.length > 0) {
            // Ordenar por peso y luego por valor (el más alto suele ser el total)
            candidates.sort((a, b) => b.weight - a.weight || b.val - a.val);
            this.results.amount = candidates[0].val;
            this.results.confidence.amount = candidates[0].weight;
            this.log(`✓ Monto detectado: $${this.results.amount}`);
        } else {
            // Búsqueda desesperada: el número más grande con decimales
            const allNumbers = cleanText.match(/\d+[\.,]\d{2}/g) || [];
            const vals = allNumbers.map(n => parseFloat(n.replace(',', '.'))).filter(v => v > 10 && v < 2000000);
            if (vals.length > 0) {
                this.results.amount = Math.max(...vals);
                this.results.confidence.amount = 40;
                this.log(`✓ Monto detectado (máximo encontrado): $${this.results.amount}`);
            }
        }

    }

    /**
     * EXTRACCIÓN DE VENCIMIENTO (CON VALIDACIÓN REALISTA)
     */
    extractDueDate() {
        this.log('Buscando fecha de vencimiento...');
        const dateRegex = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/g;
        const candidates = [];
        let match;

        const currentYear = new Date().getFullYear();

        while ((match = dateRegex.exec(this.originalText)) !== null) {
            const day = parseInt(match[1]);
            const month = parseInt(match[2]);
            let year = parseInt(match[3]);
            if (year < 100) year += 2000;

            // VALIDACIÓN CRÍTICA: Solo fechas realistas (entre el año pasado y 2 años a futuro)
            if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= currentYear - 1 && year <= currentYear + 2) {
                const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                const context = this.originalText.substring(Math.max(0, match.index - 50), match.index).toLowerCase();
                
                let weight = 50;
                if (context.includes('pago hasta') || context.includes('hasta cuando')) weight = 150;
                else if (context.includes('vencimiento') || context.includes('vto') || context.includes('vence') || context.includes('vto.')) weight = 100;
                
                if (context.includes('emisión') || context.includes('emision') || context.includes('fecha de factura')) weight = 20;
                if (context.includes('próximo') || context.includes('proximo')) weight = 80;

                candidates.push({ dateStr, weight });
            }
        }

        if (candidates.length > 0) {
            candidates.sort((a, b) => b.weight - a.weight);
            this.results.dueDate = candidates[0].dateStr;
            this.results.confidence.date = candidates[0].weight;
            this.log(`✓ Vencimiento detectado: ${this.results.dueDate}`);
        } else {
            this.log('⚠ No se encontró una fecha de vencimiento válida y realista');
        }
    }

    /**
     * EXTRACCIÓN DE CÓDIGO DE BARRAS
     */
    extractBarcode() {
        const sequences = this.originalText.match(/\d{15,60}/g) || [];
        const validCodes = sequences
            .map(s => validateBarcode(s))
            .filter(v => v.valid)
            .sort((a, b) => b.priority - a.priority);

        if (validCodes.length > 0) {
            this.results.barcode = validCodes[0].cleaned;
            this.results.confidence.barcode = validCodes[0].priority;
            this.log(`✓ Código de barras detectado: ${this.results.barcode.substring(0, 15)}...`);
        }
    }
}

function parseInvoice(text) {
    const parser = new InvoiceParser(text);
    return parser.parse();
}

module.exports = { parseInvoice, InvoiceParser };
