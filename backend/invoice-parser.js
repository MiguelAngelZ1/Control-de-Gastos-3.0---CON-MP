/**
 * ====================================
 * INVOICE-PARSER.JS - Motor de Análisis v3.0
 * ====================================
 * 
 * Optimizado para facturas de servicios de Argentina.
 * Extrae: Empresa, Titular, Monto, Vencimiento y Código de Barras.
 */

const { validateBarcode } = require('./barcode');

// Configuración de proveedores conocidos
const PROVIDERS = {
    edenor: { name: 'Edenor', patterns: ['edenor', 'empresa distribuidora norte'], type: 'electricity' },
    edesur: { name: 'Edesur', patterns: ['edesur', 'empresa distribuidora sur'], type: 'electricity' },
    metrogas: { name: 'Metrogas', patterns: ['metrogas'], type: 'gas' },
    naturgy: { name: 'Naturgy', patterns: ['naturgy', 'gas natural ban'], type: 'gas' },
    aysa: { name: 'AySA', patterns: ['aysa', 'agua y saneamientos argentinos'], type: 'water' },
    telecom: { name: 'Telecom', patterns: ['telecom', 'personal', 'flow'], type: 'telecom' },
    movistar: { name: 'Movistar', patterns: ['movistar', 'telefónica', 'telefonica'], type: 'telecom' },
    claro: { name: 'Claro', patterns: ['claro', 'amx argentina'], type: 'telecom' },
    fibertel: { name: 'Fibertel', patterns: ['fibertel', 'cablevision'], type: 'internet' },
    telecentro: { name: 'Telecentro', patterns: ['telecentro'], type: 'internet' },
    directv: { name: 'DirecTV', patterns: ['directv'], type: 'cable' }
};

class InvoiceParser {
    constructor(ocrText) {
        this.originalText = ocrText;
        this.text = this.normalizeText(ocrText);
        this.lines = ocrText.split('\n').filter(l => l.trim());
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
            .replace(/,/g, '.') // Normalizar comas a puntos para búsqueda de patrones
            .replace(/\.\./g, '.');
    }

    log(msg) {
        this.results.debug.push(msg);
        console.log(`[Parser] ${msg}`);
    }

    parse() {
        this.log('Iniciando análisis local optimizado...');
        
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
        for (const [id, config] of Object.entries(PROVIDERS)) {
            for (const pattern of config.patterns) {
                if (this.text.includes(pattern)) {
                    this.results.provider = { id, name: config.name, type: config.type };
                    this.results.confidence.provider = 100;
                    this.log(`✓ Empresa detectada: ${config.name}`);
                    return;
                }
            }
        }
        this.log('⚠ Empresa no identificada');
    }

    /**
     * EXTRACCIÓN DE TITULAR (Mejorado)
     */
    extractCustomerName() {
        // Patrones comunes para titulares en facturas
        const namePatterns = [
            /(?:titular|cliente|usuario|señor\(a\)|sr\/a)[:\s]+([A-ZÁÉÍÓÚÑ\s]{5,30})/i,
            /domicilio de suministro[:\s]+.*?[\n\r]([A-ZÁÉÍÓÚÑ\s]{5,30})/i
        ];

        for (const pattern of namePatterns) {
            const match = this.originalText.match(pattern);
            if (match && match[1]) {
                const name = match[1].trim();
                if (name.length > 5 && !/total|pago|vence|cuit|nro/i.test(name)) {
                    this.results.customerName = name.toUpperCase();
                    this.results.confidence.customerName = 85;
                    this.log(`✓ Titular detectado: ${this.results.customerName}`);
                    return;
                }
            }
        }

        // Fallback: Buscar la primera línea que parezca un nombre (Mayúsculas, 2-3 palabras)
        for (let i = 0; i < Math.min(this.lines.length, 15); i++) {
            const line = this.lines[i].trim();
            if (/^[A-ZÁÉÍÓÚÑ]{3,}\s[A-ZÁÉÍÓÚÑ]{3,}(\s[A-ZÁÉÍÓÚÑ]{3,})?$/.test(line)) {
                if (!/factura|liquidación|servicio|pago/i.test(line)) {
                    this.results.customerName = line;
                    this.results.confidence.customerName = 60;
                    this.log(`✓ Titular probable (por formato): ${line}`);
                    return;
                }
            }
        }
    }

    /**
     * EXTRACCIÓN DE MONTO (Máxima Precisión)
     */
    extractAmount() {
        const amountRegex = /\$?\s?(\d{1,3}(?:\.\d{3})*(?:,\d{2}))/g;
        const candidates = [];
        let match;

        // Buscar montos con contexto
        const textForAmount = this.originalText.replace(/\./g, ''); // Quitar puntos de miles
        const contextRegex = /(?:total|pagar|importe|monto|deuda|saldo|vencimiento)[:\s]*\$?\s*(\d+,\d{2})/gi;
        
        while ((match = contextRegex.exec(textForAmount)) !== null) {
            const val = parseFloat(match[1].replace(',', '.'));
            if (val > 10) {
                candidates.push({ val, weight: 100, context: match[0] });
            }
        }

        if (candidates.length > 0) {
            candidates.sort((a, b) => b.val - a.val); // El mayor suele ser el total
            this.results.amount = candidates[0].val;
            this.results.confidence.amount = 95;
            this.log(`✓ Monto detectado (contexto): $${this.results.amount}`);
        } else {
            // Búsqueda genérica si falla el contexto
            const genericMatches = this.originalText.match(/\d{1,3}(?:\.\d{3})*,\d{2}/g) || [];
            const genericVals = genericMatches.map(m => parseFloat(m.replace(/\./g, '').replace(',', '.'))).filter(v => v > 100);
            if (genericVals.length > 0) {
                this.results.amount = Math.max(...genericVals);
                this.results.confidence.amount = 50;
                this.log(`✓ Monto detectado (genérico): $${this.results.amount}`);
            }
        }
    }

    /**
     * EXTRACCIÓN DE VENCIMIENTO
     */
    extractDueDate() {
        const dateRegex = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/g;
        const candidates = [];
        let match;

        while ((match = dateRegex.exec(this.originalText)) !== null) {
            const day = parseInt(match[1]);
            const month = parseInt(match[2]);
            let year = parseInt(match[3]);
            if (year < 100) year += 2000;

            if (day <= 31 && month <= 12 && year >= 2024) {
                const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                const context = this.originalText.substring(Math.max(0, match.index - 30), match.index).toLowerCase();
                
                let weight = 50;
                if (context.includes('vencimiento') || context.includes('vto') || context.includes('vence')) weight = 100;
                if (context.includes('emisión') || context.includes('emision')) weight = 20;

                candidates.push({ dateStr, weight });
            }
        }

        if (candidates.length > 0) {
            candidates.sort((a, b) => b.weight - a.weight);
            this.results.dueDate = candidates[0].dateStr;
            this.results.confidence.date = candidates[0].weight;
            this.log(`✓ Vencimiento detectado: ${this.results.dueDate}`);
        }
    }

    /**
     * EXTRACCIÓN DE CÓDIGO DE BARRAS
     */
    extractBarcode() {
        const sequences = this.originalText.match(/\d{20,60}/g) || [];
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
