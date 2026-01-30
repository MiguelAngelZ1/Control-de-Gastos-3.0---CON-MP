/**
 * ====================================
 * GROQ-AI.JS - Extracción Inteligente v1.0
 * ====================================
 */

/**
 * ====================================
 * GROQ-AI.JS - Cerebro de Inteligencia Artificial
 * ====================================
 * Este módulo se encarga de conectar con la API de Groq (Llama 3.3).
 * Su función es recibir el texto sucio del OCR y transformarlo en 
 * un objeto JSON limpio y estructurado con los datos de la factura.
 */

const Groq = require('groq-sdk');

// Cargar variables de entorno
require('dotenv').config();

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

/**
 * Analiza el texto de una factura usando Llama 3 en Groq
 * @param {string} text - Texto extraído por OCR
 * @returns {Promise<object>} - Datos extraídos
 */
async function analyzeInvoiceWithGroq(text) {
    if (!process.env.GROQ_API_KEY) {
        console.warn('⚠️ GROQ_API_KEY no encontrada en .env. Usando fallback local.');
        return null;
    }

    try {
        console.log('🧠 Enviando texto a Groq AI (Llama 3)...');
        
        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `Eres un experto en análisis de facturas de Argentina. Tu objetivo es extraer datos en JSON.
                    
                    INSTRUCCIONES DE EXTRACCIÓN:
                    1. "provider": Identifica la empresa (Camuzzi, SCPL, etc.).
                    2. "customerName": Nombre del titular (ej: Imperio Miguel Angel).
                    3. "amount": Monto total. Usa punto para decimales (ej: 32644.98).
                    4. "dueDate": Fecha de vencimiento real. 
                       - IMPORTANTE: En Camuzzi, busca "¿HASTA CUANDO PUEDO PAGAR?". Esa es la fecha que me interesa (ej: 07/02/2026).
                       - Ignora el "Vto:" del encabezado si encuentras el "Hasta cuando".
                       - Formato de salida: YYYY-MM-DD.
                    5. "barcode": El código numérico de barras (largo).
                    
                    REGLA DE ORO: No asumas que la factura es de una empresa específica. Analiza el texto cuidadosamente.
                    
                    ESTRUCTURA DE RESPUESTA (JSON):
                    {
                        "provider": "Nombre Empresa",
                        "customerName": "Nombre Cliente",
                        "amount": 0000.00,
                        "dueDate": "YYYY-MM-DD",
                        "barcode": "0000000000"
                    }
                    
                    Responde SOLO el JSON.`
                },
                {
                    role: "user",
                    content: `Analiza el siguiente texto de una factura y extrae los datos:\n\n${text}`
                }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0,
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(completion.choices[0].message.content);
        console.log('✅ Datos extraídos por Groq:', result);
        return result;

    } catch (error) {
        console.error('❌ Error en Groq AI:', error);
        return null;
    }
}

module.exports = { analyzeInvoiceWithGroq };
