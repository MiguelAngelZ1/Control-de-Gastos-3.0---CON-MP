/**
 * ====================================
 * CONSTANTS.JS - Constantes del Sistema
 * Control de Gastos v1.0
 * ====================================
 * Centraliza todas las constantes, configuraciones
 * y valores por defecto del sistema.
 */

const CONSTANTS = {
    // Versión del sistema
    VERSION: '1.0.0',
    
    // Claves de localStorage
    STORAGE_KEYS: {
        INCOMES: 'cg_incomes',
        FIXED_EXPENSES: 'cg_fixed_expenses',
        WEEKLY_EXPENSES: 'cg_weekly_expenses',
        RECEIPTS: 'cg_receipts',
        SETTINGS: 'cg_settings',
        CURRENT_MONTH: 'cg_current_month'
    },
    
    // Estados de gastos fijos
    EXPENSE_STATUS: {
        PENDING: 'pending',
        INVOICE_LOADED: 'invoice_loaded',
        PROCESSING: 'processing',
        PAID: 'paid',
        ERROR: 'error'
    },
    
    // Etiquetas de estados (en español)
    STATUS_LABELS: {
        pending: 'Pendiente',
        invoice_loaded: 'Factura cargada',
        processing: 'En proceso',
        paid: 'Pagado',
        error: 'Error'
    },
    
    // Colores de estados
    STATUS_COLORS: {
        pending: 'warning',
        invoice_loaded: 'info',
        processing: 'primary',
        paid: 'success',
        error: 'danger'
    },
    
    // Iconos de estados (Bootstrap Icons)
    STATUS_ICONS: {
        pending: 'bi-clock',
        invoice_loaded: 'bi-file-earmark-check',
        processing: 'bi-arrow-repeat',
        paid: 'bi-check-circle-fill',
        error: 'bi-exclamation-triangle'
    },
    
    // Categorías de gastos fijos predefinidas
    FIXED_CATEGORIES: [
        { id: 'electricity', name: 'Luz', icon: 'bi-lightning-charge' },
        { id: 'gas', name: 'Gas', icon: 'bi-fire' },
        { id: 'water', name: 'Agua', icon: 'bi-droplet' },
        { id: 'internet', name: 'Internet', icon: 'bi-wifi' },
        { id: 'phone', name: 'Teléfono', icon: 'bi-phone' },
        { id: 'rent', name: 'Alquiler', icon: 'bi-house' },
        { id: 'netflix', name: 'Netflix', icon: 'bi-tv' },
        { id: 'spotify', name: 'Spotify', icon: 'bi-music-note-beamed' },
        { id: 'insurance', name: 'Seguro', icon: 'bi-shield-check' },
        { id: 'other', name: 'Otro', icon: 'bi-three-dots' }
    ],
    
    // Categorías de gastos variables
    VARIABLE_CATEGORIES: [
        { id: 'food', name: 'Alimentación', icon: 'bi-cart' },
        { id: 'transport', name: 'Transporte', icon: 'bi-car-front' },
        { id: 'entertainment', name: 'Entretenimiento', icon: 'bi-controller' },
        { id: 'health', name: 'Salud', icon: 'bi-heart-pulse' },
        { id: 'clothing', name: 'Ropa', icon: 'bi-bag' },
        { id: 'education', name: 'Educación', icon: 'bi-book' },
        { id: 'personal', name: 'Personal', icon: 'bi-person' },
        { id: 'other', name: 'Otro', icon: 'bi-three-dots' }
    ],
    
    // Configuración de Mercado Pago (preparado para integración real)
    MERCADO_PAGO: {
        // URL base para redirección (sandbox)
        BASE_URL: 'https://www.mercadopago.com.ar/checkout/v1/redirect',
        // En producción se usaría la API real
        SANDBOX_MODE: true,
        // Prefijo para referencias de pago
        REFERENCE_PREFIX: 'CG-'
    },
    
    // Configuración de archivos
    FILE_CONFIG: {
        MAX_SIZE_MB: 5,
        ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
        ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp', '.pdf']
    },
    
    // Número de semanas por mes (fijo en 4)
    WEEKS_PER_MONTH: 4,
    
    // Mensajes del sistema
    MESSAGES: {
        CONFIRM_DELETE: '¿Estás seguro de que querés eliminar este elemento?',
        CONFIRM_DELETE_INCOME: '¿Eliminar este ingreso? Esto afectará tu presupuesto disponible.',
        CONFIRM_DELETE_EXPENSE: '¿Eliminar este gasto? Esta acción no se puede deshacer.',
        SUCCESS_SAVE: 'Guardado correctamente',
        SUCCESS_DELETE: 'Eliminado correctamente',
        ERROR_FILE_SIZE: 'El archivo supera el tamaño máximo permitido (5MB)',
        ERROR_FILE_TYPE: 'Tipo de archivo no permitido. Usá JPG, PNG, WebP o PDF.',
        ERROR_GENERIC: 'Ocurrió un error. Por favor, intentá de nuevo.',
        INVOICE_ANALYZING: 'Analizando factura...',
        INVOICE_READY: 'Factura procesada correctamente',
        PAYMENT_REDIRECT: 'Redirigiendo a Mercado Pago...'
    },
    
    // Animaciones
    ANIMATION_DURATION: 300
};

// Congelar el objeto para prevenir modificaciones
Object.freeze(CONSTANTS);
Object.freeze(CONSTANTS.STORAGE_KEYS);
Object.freeze(CONSTANTS.EXPENSE_STATUS);
Object.freeze(CONSTANTS.STATUS_LABELS);
Object.freeze(CONSTANTS.STATUS_COLORS);
Object.freeze(CONSTANTS.STATUS_ICONS);
Object.freeze(CONSTANTS.MERCADO_PAGO);
Object.freeze(CONSTANTS.FILE_CONFIG);
Object.freeze(CONSTANTS.MESSAGES);

// Exportar para uso modular (compatible con ES modules y script tradicional)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONSTANTS;
}
