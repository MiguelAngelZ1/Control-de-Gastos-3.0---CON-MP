const { GoogleGenAI } = require("@google/genai");
require('dotenv').config();

// Initialize the API client
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

/**
 * Módulo de Gemini Service
 * Parsea facturas usando Google Gemini
 */
const GeminiService = {
    /**
     * Parsea el texto extraído de una factura
     * @param {string} text - Texto extraído (OCR)
     * @returns {Promise<object>} Datos estructurados
     */
    async parseInvoiceWithGemini(text) {
        if (!ai) {
            console.warn('⚠️ GEMINI_API_KEY no configurada. Usando parser local.');
            return null;
        }

        try {
            console.log('🤖 Consultando a Gemini...');
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.0-flash-exp',
                contents: `Eres un experto en facturas de servicios públicos de Argentina.

TAREA: Analiza el texto de una factura y extrae los datos en formato JSON.

REGLAS CRÍTICAS PARA EL CÓDIGO DE BARRAS:
1. El código de barras para pago electrónico (Interbanking/PMC/PagoMisCuentas) tiene entre 40 y 60 dígitos.
2. NO uses códigos cortos de 20-30 dígitos - esos son códigos internos.
3. NO uses el número de factura ni el número de cliente.
4. Busca la secuencia numérica MÁS LARGA disponible (generalmente cerca de "código de barras", "pago electrónico", "Interbanking" o al final de la factura).
5. Elimina TODOS los espacios del código de barras.
6. Si hay múltiples códigos largos, prefiere el que tenga 40+ dígitos.

REGLAS PARA OTROS CAMPOS:
- "amount": Total a pagar FINAL (número decimal, ej: 15420.50)
- "dueDate": Fecha de vencimiento en formato YYYY-MM-DD
- "provider": Nombre de la empresa (Edenor, Metrogas, Telecom, AySA, etc)
- "reference": Número de referencia o código de pago electrónico corto

Texto de la factura:
${text.substring(0, 12000)}`,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "OBJECT",
                        properties: {
                            provider: { type: "STRING" },
                            invoiceNumber: { type: "STRING" },
                            dueDate: { type: "STRING" },
                            amount: { type: "NUMBER" },
                            barcode: { type: "STRING" },
                            reference: { type: "STRING" }
                        },
                        required: ["provider", "dueDate", "amount", "barcode"]
                    }
                }
            });

            const jsonStr = response.text();
            console.log('✅ Respuesta de Gemini recibida');
            
            const parsed = JSON.parse(jsonStr);
            
            // Validar que el código de barras tenga la longitud correcta
            if (parsed.barcode) {
                const cleanBarcode = parsed.barcode.replace(/\s/g, '');
                if (cleanBarcode.length >= 40 && cleanBarcode.length <= 60) {
                    parsed.barcode = cleanBarcode;
                    console.log(`✅ Código de barras válido: ${cleanBarcode.length} dígitos`);
                } else {
                    console.warn(`⚠️ Código de barras con longitud inesperada: ${cleanBarcode.length} dígitos`);
                    // Aún así lo guardamos, pero marcamos la advertencia
                    parsed.barcode = cleanBarcode;
                    parsed.barcodeWarning = `Longitud: ${cleanBarcode.length} (esperado: 40-60)`;
                }
            }
            
            return parsed;

        } catch (error) {
            console.error('❌ Error en Gemini Service:', error);
            return null;
        }
    }
};

module.exports = GeminiService;