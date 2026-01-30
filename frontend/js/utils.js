/**
 * ====================================
 * UTILS.JS - Utilidades del Sistema
 * Control de Gastos v1.0
 * ====================================
 * Funciones de utilidad reutilizables
 * en todo el sistema.
 */

const Utils = {
    /**
     * Genera un ID único
     * @returns {string} ID único
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    /**
     * Formatea un número como moneda (ARS)
     * @param {number} amount - Monto a formatear
     * @returns {string} Monto formateado
     */
    formatCurrency(amount) {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 2
        }).format(amount || 0);
    },

    /**
     * Formatea una fecha
     * @param {Date|string} date - Fecha a formatear
     * @param {string} format - Formato deseado
     * @returns {string} Fecha formateada
     */
    formatDate(date, format = 'short') {
        const d = new Date(date);
        const options = {
            short: { day: '2-digit', month: '2-digit', year: 'numeric' },
            long: { day: '2-digit', month: 'long', year: 'numeric' },
            time: { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
        };
        return d.toLocaleDateString('es-AR', options[format] || options.short);
    },

    /**
     * Obtiene el mes y año actual
     * @returns {object} { month, year, key }
     */
    getCurrentMonthYear() {
        const now = new Date();
        return {
            month: now.getMonth(),
            year: now.getFullYear(),
            key: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        };
    },

    /**
     * Obtiene el mes y año siguiente
     * @returns {object} { month, year, key }
     */
    getNextMonthYear() {
        const now = new Date();
        const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return {
            month: next.getMonth(),
            year: next.getFullYear(),
            key: `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
        };
    },

    /**
     * Obtiene el nombre del mes
     * @param {number} month - Índice del mes (0-11)
     * @returns {string} Nombre del mes
     */
    getMonthName(month) {
        const months = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        return months[month];
    },

    /**
     * Calcula las 4 semanas del mes actual
     * @returns {Array} Array de objetos con info de cada semana
     */
    getWeeksOfMonth(month = null, year = null) {
        const now = new Date();
        const y = year ?? now.getFullYear();
        const m = month ?? now.getMonth();
        const firstDay = new Date(y, m, 1);
        const lastDay = new Date(y, m + 1, 0);
        const totalDays = lastDay.getDate();
        
        // Dividir el mes en exactamente 4 semanas
        const daysPerWeek = Math.ceil(totalDays / 4);
        const weeks = [];

        for (let weekNumber = 1; weekNumber <= 4; weekNumber++) {
            const startDay = (weekNumber - 1) * daysPerWeek + 1;
            const endDay = weekNumber === 4 ? totalDays : Math.min(weekNumber * daysPerWeek, totalDays);
            
            const weekStart = new Date(y, m, startDay);
            const weekEnd = new Date(y, m, endDay);

            weeks.push({
                number: weekNumber,
                start: weekStart,
                end: weekEnd,
                label: `Semana ${weekNumber}`,
                range: `${startDay} - ${endDay} ${this.getMonthName(m)}`
            });
        }

        return weeks;
    },

    /**
     * Obtiene la semana actual del mes (1-4)
     * @returns {number} Número de semana (1-4)
     */
    getCurrentWeekOfMonth() {
        const now = new Date();
        const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const daysPerWeek = Math.ceil(totalDays / 4);
        const dayOfMonth = now.getDate();
        const weekNumber = Math.ceil(dayOfMonth / daysPerWeek);
        return Math.min(weekNumber, 4);
    },

    /**
     * Parsea una key de mes (YYYY-MM) al índice del mes (0-11)
     * @param {string} key - Formato "YYYY-MM"
     * @returns {number} Índice del mes (0-11)
     */
    parseMonth(key) {
        if (!key || typeof key !== 'string') return 0;
        const parts = key.split('-');
        return (parseInt(parts[1]) - 1) || 0;
    },

    /**
     * Parsea un string a número
     * @param {string} value - Valor a parsear
     * @returns {number} Número parseado
     */
    parseNumber(value) {
        if (typeof value === 'number') return value;
        const cleaned = String(value).replace(/[^0-9.,]/g, '').replace(',', '.');
        return parseFloat(cleaned) || 0;
    },

    /**
     * Valida un archivo
     * @param {File} file - Archivo a validar
     * @returns {object} { valid, error }
     */
    validateFile(file) {
        const maxSize = CONSTANTS.FILE_CONFIG.MAX_SIZE_MB * 1024 * 1024;
        const allowedTypes = CONSTANTS.FILE_CONFIG.ALLOWED_TYPES;

        if (file.size > maxSize) {
            return { valid: false, error: CONSTANTS.MESSAGES.ERROR_FILE_SIZE };
        }

        if (!allowedTypes.includes(file.type)) {
            return { valid: false, error: CONSTANTS.MESSAGES.ERROR_FILE_TYPE };
        }

        return { valid: true, error: null };
    },

    /**
     * Convierte un archivo a Base64
     * @param {File} file - Archivo a convertir
     * @returns {Promise<string>} Base64 string
     */
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        });
    },

    /**
     * Simula extracción de datos de factura (mock para frontend)
     * En producción, esto llamaría a un servicio de OCR
     * @param {string} base64 - Archivo en base64
     * @returns {Promise<object>} Datos extraídos
     */
    async extractInvoiceData(base64) {
        // Simular delay de procesamiento
        await this.delay(1500);

        // Mock de datos extraídos
        // En producción, esto sería reemplazado por llamada a API de OCR
        const mockData = {
            amount: Math.floor(Math.random() * 10000) + 1000,
            barcode: this.generateBarcode(),
            reference: `REF-${Date.now().toString().slice(-8)}`,
            dueDate: this.addDays(new Date(), Math.floor(Math.random() * 15) + 5),
            confidence: 0.85 + Math.random() * 0.14 // 85-99% confianza
        };

        return {
            success: true,
            data: mockData,
            message: 'Datos extraídos correctamente'
        };
    },

    /**
     * Genera un código de barras simulado
     * @returns {string} Código de barras
     */
    generateBarcode() {
        let barcode = '';
        for (let i = 0; i < 23; i++) {
            barcode += Math.floor(Math.random() * 10);
        }
        return barcode;
    },

    /**
     * Agrega días a una fecha
     * @param {Date} date - Fecha base
     * @param {number} days - Días a agregar
     * @returns {Date} Nueva fecha
     */
    addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    },

    /**
     * Delay/sleep utility
     * @param {number} ms - Milisegundos
     * @returns {Promise}
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * Debounce function
     * @param {Function} func - Función a ejecutar
     * @param {number} wait - Tiempo de espera
     * @returns {Function}
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Calcula el porcentaje
     * @param {number} value - Valor actual
     * @param {number} total - Total
     * @returns {number} Porcentaje
     */
    percentage(value, total) {
        if (total === 0) return 0;
        return Math.round((value / total) * 100);
    },

    /**
     * Clona un objeto profundamente
     * @param {object} obj - Objeto a clonar
     * @returns {object} Objeto clonado
     */
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    /**
     * Verifica si es dispositivo móvil
     * @returns {boolean}
     */
    isMobile() {
        return window.innerWidth < 768;
    },

    /**
     * Trunca texto
     * @param {string} text - Texto a truncar
     * @param {number} length - Longitud máxima
     * @returns {string} Texto truncado
     */
    truncate(text, length = 30) {
        if (!text) return '';
        if (text.length <= length) return text;
        return text.substring(0, length) + '...';
    },

    /**
     * Obtiene el nombre del día de la semana
     * @param {number} day - Índice del día (0-6)
     * @returns {string} Nombre del día
     */
    getDayName(day) {
        const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        return days[day];
    },

    /**
     * Formatea la fecha completa: "26 de Enero 2025"
     * @param {Date} date - Fecha a formatear
     * @returns {string} Fecha formateada
     */
    formatFullDate(date = new Date()) {
        const day = date.getDate();
        const month = this.getMonthName(date.getMonth());
        const year = date.getFullYear();
        return `${day} de ${month} ${year}`;
    },

    /**
     * Formatea un número con separadores de miles
     * @param {string|number} value - Valor a formatear
     * @returns {string} Valor formateado con puntos como separador de miles
     */
    formatNumberWithThousands(value) {
        // Remover todo excepto dígitos
        const numbers = String(value).replace(/\D/g, '');
        if (!numbers) return '';
        
        // Formatear con puntos cada 3 dígitos
        return numbers.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    },

    /**
     * Parsea un número formateado (con puntos de miles) a número
     * @param {string} formattedValue - Valor con formato "1.234.567"
     * @returns {number} Número parseado
     */
    parseFormattedNumber(formattedValue) {
        if (!formattedValue) return 0;
        // Remover puntos de miles y convertir a número
        const cleaned = String(formattedValue).replace(/\./g, '').replace(/,/g, '.');
        return parseFloat(cleaned) || 0;
    },

    /**
     * Inicializa los inputs de dinero con formateo automático
     * Usa COMA como separador de miles y PUNTO como separador decimal
     * Ejemplo: 1.234.567,89
     */
    initMoneyInputs() {
        const self = this;
        
        document.querySelectorAll('.money-input').forEach(input => {
            // Remover listeners anteriores clonando el elemento
            const newInput = input.cloneNode(true);
            input.parentNode.replaceChild(newInput, input);
            
            // Formatear al escribir
            newInput.addEventListener('input', function(e) {
                let cursorPosition = e.target.selectionStart;
                let originalValue = e.target.value;
                
                // Limpiar valor: solo dejar dígitos y una coma
                let cleanValue = originalValue.replace(/\./g, ''); 
                
                if (!cleanValue) return;
                
                // Dividir en parte entera y decimal
                const parts = cleanValue.split(',');
                let integerPart = parts[0].replace(/\D/g, ''); 
                let decimalPart = parts.length > 1 ? parts[1].replace(/\D/g, '').substring(0, 2) : null;
                
                // Si el número es muy largo, simplemente lo dejamos ser (sin límites)
                // Formatear con puntos de miles
                const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
                
                let finalValue = formattedInteger;
                if (decimalPart !== null) finalValue += ',' + decimalPart;
                
                if (e.target.value !== finalValue) {
                    const diff = finalValue.length - originalValue.length;
                    e.target.value = finalValue;
                    e.target.setSelectionRange(cursorPosition + diff, cursorPosition + diff);
                }
            });
            
            // Permitir solo teclas válidas
            newInput.addEventListener('keydown', function(e) {
                const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter', 'Home', 'End'];
                if (allowedKeys.includes(e.key)) return;
                
                // Permitir coma solo si no hay una ya
                if ((e.key === ',' || e.key === '.') && !e.target.value.includes(',')) {
                    return;
                }
                
                // Permitir números
                if (/[0-9]/.test(e.key)) return;
                
                e.preventDefault();
            });
        });
    }
};

// Exportar
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}
