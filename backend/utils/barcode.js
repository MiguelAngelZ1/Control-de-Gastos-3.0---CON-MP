/**
 * ====================================
 * BARCODE.JS - Validador de Códigos v3.0
 * ====================================
 */

/**
 * Valida si un string es un código de barras de servicio argentino
 */
function validateBarcode(code) {
    if (!code) return { valid: false };
    
    const cleaned = code.replace(/\D/g, '');
    const len = cleaned.length;

    // Prioridad por longitud y tipo
    let priority = 0;
    let type = 'unknown';

    // 1. Códigos de Pago Mis Cuentas / Interbanking (40-60 dígitos)
    if (len >= 40 && len <= 60) {
        priority = 100;
        type = 'pmc_interbanking';
    }
    // 2. Códigos de barras estándar de facturas (23-39 dígitos)
    else if (len >= 23 && len < 40) {
        priority = 80;
        type = 'standard_service';
    }
    // 3. CBU o códigos cortos (19-22 dígitos)
    else if (len >= 19 && len <= 22) {
        priority = 50;
        type = 'electronic_payment';
    }

    return {
        valid: len >= 19 && len <= 65,
        cleaned,
        length: len,
        priority,
        type
    };
}

module.exports = { validateBarcode };
