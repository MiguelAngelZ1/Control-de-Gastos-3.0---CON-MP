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
                contents: `Eres un EXPERTO MAESTRO en análisis de facturas de servicios de Argentina. Tu tarea es extraer información con PRECISIÓN ABSOLUTA.

═══ PROMPT MAESTRO: EXTRACCIÓN DE FACTURAS ═══

✅ CAMPO 1: EMPRESA (provider)
BUSCA en este ORDEN:
1. Logo o nombre grande en el encabezado (primera línea)
2. Razón social cerca del CUIT
3. Nombre en el pie de página
4. Cualquier mención de empresa de servicios

EMPRESAS COMUNES: Edenor, Edesur, Metrogas, Naturgy, AySA, Telecom, Personal, Claro, Movistar, Fibertel

REGLA: Si encuentras CUALQUIER nombre de empresa, devúelvelo. NO devuelvas "No identificado" o "Desconocido".

✅ CAMPO 2: TITULAR (customerName)
BUSCA en este ORDEN:
1. Después de "Titular:", "Cliente:", "Señor/a:"
2. Cerca de "Dirección de suministro" o "Domicilio"
3. Después del número de cliente
4. En la sección superior de la factura

FORMATO: Nombre completo en MAYÚSCULAS (ej: JUAN CARLOS PEREZ, MARIA FERNANDA GARCIA)

REGLA: Si encuentras UN NOMBRE DE PERSONA, devúelvelo SIN prefijos (sin "Sr.", "Sra.", "Titular"). NO devuelvas "No detectado".

✅ CAMPO 3: FECHA DE VENCIMIENTO (dueDate)
BUSCA en este ORDEN:
1. Después de "Vencimiento:", "Vto:", "Fecha de vencimiento:"
2. "1er vencimiento" o "Primer vencimiento" (ignora 2do vencimiento)
3. Cerca de "Total a pagar"
4. En recuadros destacados o con fondo de color

FORMATOS POSIBLES:
- DD/MM/YYYY (ej: 25/01/2025)
- DD-MM-YYYY (ej: 25-01-2025)
- DD.MM.YYYY (ej: 25.01.2025)
- DD de MES de YYYY (ej: 25 de enero de 2025)

CONVERSIÓN: Siempre devuelve en formato YYYY-MM-DD (ej: 2025-01-25)

REGLA: Si hay múltiples fechas, usa la más cercana a "vencimiento" o "total a pagar". NO uses la fecha de emisión.

✅ CAMPO 4: MONTO (amount)
BUSCA "Total a pagar", "Importe a pagar", "Total factura"
FORMATO: Número decimal (ej: 15420.50)
REGLA: Usa el monto FINAL, no subtotales.

✅ CAMPO 5: CÓDIGO DE BARRAS (barcode)
BUSCA secuencia de 40-60 dígitos cerca de:
- "Código de barras"
- "Pago electrónico"
- "Interbanking"
- "PMC" o "PagoMisCuentas"

REGLA: Debe tener 40-60 dígitos. NO uses códigos de 20-30 dígitos.

═══ TEXTO DE LA FACTURA ═══
${text.substring(0, 12000)}

═══ INSTRUCCIONES FINALES ═══
Analiza TODO el texto. NO omitas campos. Si un campo es difícil de encontrar, BUSCA MÁS. Devuelve JSON válido.`,
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
