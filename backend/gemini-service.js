
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
                model: 'gemini-2.0-flash-exp', // Usando modelo rápido y eficiente
                contents: `Analiza el siguiente texto de una factura de servicios públicos de Argentina y extrae los datos requeridos en formato JSON.
                
                REGLAS IMPORTANTES:
                1. Manten el formato JSON estricto.
                2. Para "barcode": Busca la cadena de números más larga disponible (generalmente entre 40 y 60 dígitos). Es el código de barras para pago electrónico (Interbanking/PMC). NO uses el número de factura ni el código corto. Si hay espacios, elimínalos.
                3. Para "amount": El total a pagar final. Usa formato numérico (float).
                4. Para "dueDate": Fecha de vencimiento en formato YYYY-MM-DD.
                5. Para "provider": Nombre de la empresa (ej: Edenor, Metrogas, Telecom, Personal, etc).
                6. Para "reference": Número de referencia de pago o código de pago electrónico (si es distinto al barcode, sino usa el barcode o lo que sirva para identificar el pago).

                Texto extraído:
                ${text.substring(0, 10000)}`, // Limitar longitud para evitar tokens excesivos
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
            return JSON.parse(jsonStr);

        } catch (error) {
            console.error('❌ Error en Gemini Service:', error);
            // Retornar null para que el sistema use el parser local como fallback
            return null;
        }
    }
};

module.exports = GeminiService;
