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
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Cargar variables de entorno
require('dotenv').config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Motor inteligente con Fallback: Groq -> Gemini -> Local
 */
async function analyzeInvoiceWithAI(text) {
    // 1. Intentar con Groq (Llama 3.3)
    if (process.env.GROQ_API_KEY) {
        const groqResult = await analyzeWithGroq(text);
        if (groqResult) return groqResult;
    }

    // 2. Fallback a Gemini
    if (process.env.GEMINI_API_KEY) {
        console.warn('⚠️ Groq falló o no disponible. Intentando con Gemini...');
        const geminiResult = await analyzeWithGemini(text);
        if (geminiResult) return geminiResult;
    }

    console.warn('❌ No hay servicios de IA disponibles o fallaron. Se usará el extractor local.');
    return null;
}

const SYSTEM_PROMPT = `Eres un experto en análisis de facturas de Argentina. Tu objetivo es extraer datos en JSON.
INSTRUCCIONES:
1. "provider": Empresa (Camuzzi, SCPL, Telecom, etc.).
2. "customerName": Nombre del titular.
3. "amount": Monto total (float).
4. "dueDate": Fecha vencimiento (YYYY-MM-DD). En Camuzzi busca "¿HASTA CUANDO PUEDO PAGAR?".
5. "barcode": Secuencia LARGA de números (40-60 dígitos). No la resumas.
Responde SOLO JSON.`;

async function analyzeWithGroq(text) {
    try {
        console.log('🧠 Enviando a Groq (Llama 3)...');
        const completion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: text }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0,
            response_format: { type: "json_object" }
        });
        return JSON.parse(completion.choices[0].message.content);
    } catch (e) {
        console.error('❌ Error Groq:', e.message);
        return null;
    }
}

async function analyzeWithGemini(text) {
    try {
        console.log('✨ Enviando a Gemini...');
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `${SYSTEM_PROMPT}\n\nTexto factura:\n${text}`;
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (e) {
        console.error('❌ Error Gemini:', e.message);
        return null;
    }
}

module.exports = { analyzeInvoiceWithGroq: analyzeInvoiceWithAI };

