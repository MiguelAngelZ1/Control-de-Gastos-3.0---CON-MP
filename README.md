# 📄 Invoice Parser v2.0

## 🧠 Parser Inteligente basado en Contexto

Este sistema resuelve el problema principal del OCR en facturas: **hay demasiados números, montos y fechas, y el sistema no sabe cuál es el correcto.**

### El Problema

Una factura típica contiene:
- 5-10 montos diferentes (IVA, subtotales, impuestos, consumo, total)
- 3-5 fechas (emisión, período, vencimiento 1, vencimiento 2)
- Múltiples códigos numéricos (cliente, cuenta, CUIT, código de barras)

El OCR extrae TODO, pero ¿cómo saber cuál es el **monto a pagar** y cuál el **IVA**?

### La Solución: Análisis de Contexto

El Parser v2.0 funciona como lo hacen **Mercado Pago**, **Rapipago** y **PagoFácil**:

1. **Detecta el proveedor** (Edenor, Metrogas, Telecom, etc.)
2. **Extrae todos los candidatos** (montos, fechas, códigos)
3. **Analiza el contexto** de cada valor (palabras cercanas)
4. **Asigna scores** basados en reglas estrictas
5. **Selecciona el mejor candidato** para cada campo
6. **Valida cruzadamente** los resultados

## 🚀 Inicio Rápido

```bash
# Instalar dependencias
npm install

# Iniciar servidor
npm start

# Abrir en navegador
http://localhost:3000
```

## 📋 Cómo Funciona el Scoring

### Montos

El sistema busca palabras cercanas al monto:

| Contexto | Score |
|----------|-------|
| "total a pagar" | +100 |
| "importe a pagar" | +100 |
| "debe abonar" | +95 |
| "total factura" | +90 |
| "total" | +70 |
| "iva" | -80 |
| "impuesto" | -70 |
| "subtotal" | -70 |
| "saldo anterior" | -80 |

### Fechas

| Contexto | Score |
|----------|-------|
| "vencimiento" | +100 |
| "vto" | +100 |
| "fecha límite" | +95 |
| "1er vencimiento" | +100 |
| "emisión" | -90 |
| "período" | -70 |
| "lectura" | -80 |

### Códigos de Barras

| Criterio | Score |
|----------|-------|
| Longitud 23/40/44 dígitos | +30 |
| Contexto "código de barras" | +35 |
| Contexto "pago" | +25 |
| Contexto "cuenta" | -40 |
| Prefijo válido (02, 2x) | +15 |

## 🏢 Proveedores Soportados

El sistema detecta automáticamente:

- **Electricidad:** Edenor, Edesur
- **Gas:** Metrogas, Naturgy, Camuzzi
- **Agua:** AySA
- **Telecomunicaciones:** Telecom, Movistar, Claro, Personal
- **Internet/Cable:** Fibertel, Cablevisión
- **Seguros:** Detección genérica

Cada proveedor tiene reglas específicas para mejorar la precisión.

## 📁 Estructura del Proyecto

```
/
├── package.json
├── README.md
├── backend/
│   ├── server.js          # Servidor Express
│   ├── ocr.js              # Motor OCR (Tesseract.js)
│   ├── invoice-parser.js   # 🧠 Parser inteligente (NUEVO)
│   ├── barcode.js          # Detección de códigos
│   └── utils.js            # Utilidades
└── frontend/
    └── index.html          # Interfaz de usuario
```

## 🔧 API

### POST /api/invoice/upload

```javascript
// Request
FormData { invoice: File }

// Response
{
  "success": true,
  "processingTime": "5.23s",
  "extracted": {
    "amount": 15430.50,
    "amountFormatted": "$15.430,50",
    "amountConfidence": 85,      // Score del parser
    "dueDate": "2024-02-15",
    "dueDateFormatted": "15/02/2024",
    "dueDateConfidence": 92,
    "barcode": "2345678901234567890123",
    "barcodeConfidence": 78,
    "provider": {
      "id": "edenor",
      "name": "Edenor",
      "type": "electricity"
    }
  },
  "alternatives": {
    "amounts": [
      { "value": 15430.50, "formatted": "$15.430,50", "score": 85 },
      { "value": 2890.00, "formatted": "$2.890,00", "score": 35 }
    ],
    "dates": [...],
    "barcodes": [...]
  },
  "debug": [
    "Detectando proveedor...",
    "✓ Proveedor detectado: Edenor (electricity)",
    "Monto $15430.50 -> Score: 85 [+100: \"total a pagar\", +10: rango típico]",
    ...
  ],
  "rawText": "..."
}
```

## 💡 Diferencias con v1.0

| Aspecto | v1.0 | v2.0 |
|---------|------|------|
| Selección de monto | Primer match | Por contexto |
| Múltiples fechas | Primera encontrada | Analiza todas |
| Código de barras | Solo por longitud | Contexto + validación |
| Confianza | Fija | Calculada dinámicamente |
| Proveedores | No detecta | Detección automática |
| Falsos positivos | Muchos | Filtrados por reglas |

## ⚠️ Limitaciones

1. **Calidad del OCR:** Si el OCR falla, el parser no puede ayudar
2. **Formatos desconocidos:** Facturas con layouts muy diferentes pueden no parsearse bien
3. **Idioma:** Optimizado para español argentino
4. **Códigos de barras:** Se extraen del texto, no se decodifican de la imagen

## 🔮 Mejoras Futuras

- [ ] Machine Learning para mejorar el scoring
- [ ] Plantillas específicas por proveedor
- [ ] Decodificación real de códigos de barras
- [ ] Soporte para más países
- [ ] API de validación de códigos de pago

---

**v2.0** - Parser inteligente basado en contexto
