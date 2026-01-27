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
                contents: `Eres un experto en facturas de servicios de Argentina.

TAREA: Analiza el texto de una factura y extrae los datos en formato JSON.

REGLAS CRÍTICAS PARA EL CÓDIGO DE BARRAS:
1. El código de barras para pago electrónico (Interbanking/PMC/PagoMisCuentas) tiene entre 40 y 60 dígitos.
2. NO uses códigos cortos de 20-30 dígitos - esos son códigos internos.
3. NO uses el número de factura ni el número de cliente.
4. Busca la secuencia numérica MÁS LARGA disponible (generalmente cerca de "código de barras", "pago electrónico", "Interbanking" o al final de la factura).
5. Elimina TODOS los espacios del código de barras.
6. Si hay múltiples códigos largos, prefiere el que tenga 40+ dígitos.

REGLAS PARA OTROS CAMPOS:
- "provider": Nombre de la empresa emisora (ej: Edenor, Metrogas, Telecom, AySA, Personal, Edesur, Naturgy, etc). Debe ser el nombre comercial. Analiza el encabezado y pie de página. NO devuelvas "No identificado" si hay cualquier indicio de una empresa de servicios.
- "customerName": Nombre del titular del servicio. Busca nombres propios (Ej: JUAN PEREZ, MARIA GARCIA). Suele estar debajo del logo o cerca de la dirección de suministro. Ignora términos como "Señor/a", "Titular", "Cliente". NO devuelvas "No detectado" si hay un nombre de persona en la factura.
- "amount": Total a pagar FINAL (número decimal, ej: 15420.50).
- "dueDate": Fecha de vencimiento en formato YYYY-MM-DD.
- "reference": Número de referencia o código de pago electrónico corto.

Texto de la factura:
${text.substring(0, 12000)}`,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "OBJECT",
                        properties: {
                            provider: { type: "STRING", description: "Nombre comercial de la empresa" },
                            customerName: { type: "STRING", description: "Nombre completo del titular del servicio" },
                            invoiceNumber: { type: "STRING" },
                            dueDate: { type: "STRING", description: "Fecha en formato YYYY-MM-DD" },
                            amount: { type: "NUMBER", description: "Monto total a pagar" },
                            barcode: { type: "STRING", description: "Código de barras largo (40-60 dígitos)" },
                            reference: { type: "STRING" }
                        },
                        required: ["provider", "customerName", "dueDate", "amount", "barcode"]
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
