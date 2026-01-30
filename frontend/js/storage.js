/**
 * ====================================
 * STORAGE.JS - Capa de Persistencia
 * Control de Gastos v1.0
 * ====================================
 * Gestiona toda la persistencia de datos.
 * Preparado para migrar a backend real.
 */

const Storage = {
    /**
     * Guarda datos en localStorage
     * @param {string} key - Clave de almacenamiento
     * @param {any} data - Datos a guardar
     * @returns {boolean} Éxito de la operación
     */
    save(key, data) {
        try {
            const serialized = JSON.stringify(data);
            localStorage.setItem(key, serialized);
            return true;
        } catch (error) {
            console.error('Storage.save error:', error);
            return false;
        }
    },

    /**
     * Obtiene datos de localStorage
     * @param {string} key - Clave de almacenamiento
     * @param {any} defaultValue - Valor por defecto
     * @returns {any} Datos obtenidos o valor por defecto
     */
    get(key, defaultValue = null) {
        try {
            const serialized = localStorage.getItem(key);
            if (serialized === null) return defaultValue;
            return JSON.parse(serialized);
        } catch (error) {
            console.error('Storage.get error:', error);
            return defaultValue;
        }
    },

    /**
     * Elimina datos de localStorage
     * @param {string} key - Clave de almacenamiento
     * @returns {boolean} Éxito de la operación
     */
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Storage.remove error:', error);
            return false;
        }
    },

    /**
     * Limpia todo el almacenamiento del sistema
     * @returns {boolean} Éxito de la operación
     */
    clear() {
        try {
            Object.values(CONSTANTS.STORAGE_KEYS).forEach(key => {
                localStorage.removeItem(key);
            });
            return true;
        } catch (error) {
            console.error('Storage.clear error:', error);
            return false;
        }
    },

    // ==========================================
    // INGRESOS
    // ==========================================

    /**
     * Obtiene todos los ingresos
     * @returns {Array} Lista de ingresos
     */
    getIncomes() {
        return this.get(CONSTANTS.STORAGE_KEYS.INCOMES, []);
    },

    /**
     * Guarda un nuevo ingreso
     * @param {object} income - Datos del ingreso
     * @returns {object} Ingreso guardado
     */
    saveIncome(income) {
        const incomes = this.getIncomes();
        const newIncome = {
            id: Utils.generateId(),
            ...income,
            createdAt: new Date().toISOString()
        };
        incomes.push(newIncome);
        this.save(CONSTANTS.STORAGE_KEYS.INCOMES, incomes);
        return newIncome;
    },

    /**
     * Elimina un ingreso
     * @param {string} id - ID del ingreso
     * @returns {boolean} Éxito de la operación
     */
    deleteIncome(id) {
        const incomes = this.getIncomes().filter(i => i.id !== id);
        return this.save(CONSTANTS.STORAGE_KEYS.INCOMES, incomes);
    },

    /**
     * Obtiene el total de ingresos del mes actual
     * @returns {number} Total de ingresos
     */
    getTotalIncomes() {
        const { key } = Utils.getCurrentMonthYear();
        return this.getIncomes()
            .filter(i => i.monthKey === key)
            .reduce((sum, i) => sum + Utils.parseNumber(i.amount), 0);
    },

    // ==========================================
    // GASTOS FIJOS
    // ==========================================

    /**
     * Obtiene todos los gastos fijos
     * @returns {Array} Lista de gastos fijos
     */
    getFixedExpenses() {
        return this.get(CONSTANTS.STORAGE_KEYS.FIXED_EXPENSES, []);
    },

    /**
     * Guarda un nuevo gasto fijo
     * @param {object} expense - Datos del gasto
     * @returns {object} Gasto guardado
     */
    saveFixedExpense(expense) {
        const expenses = this.getFixedExpenses();
        const newExpense = {
            id: Utils.generateId(),
            ...expense,
            status: CONSTANTS.EXPENSE_STATUS.PENDING,
            invoice: null,
            invoiceData: null,
            receipt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        expenses.push(newExpense);
        this.save(CONSTANTS.STORAGE_KEYS.FIXED_EXPENSES, expenses);
        return newExpense;
    },

    /**
     * Actualiza un gasto fijo
     * @param {string} id - ID del gasto
     * @param {object} updates - Datos a actualizar
     * @returns {object|null} Gasto actualizado o null
     */
    updateFixedExpense(id, updates) {
        const expenses = this.getFixedExpenses();
        const index = expenses.findIndex(e => e.id === id);
        
        if (index === -1) return null;
        
        expenses[index] = {
            ...expenses[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        
        this.save(CONSTANTS.STORAGE_KEYS.FIXED_EXPENSES, expenses);
        return expenses[index];
    },

    /**
     * Elimina un gasto fijo
     * @param {string} id - ID del gasto
     * @returns {boolean} Éxito de la operación
     */
    deleteFixedExpense(id) {
        const expenses = this.getFixedExpenses();
        const expenseToDelete = expenses.find(e => e.id === id);
        
        // Si tiene comprobante, eliminarlo también
        if (expenseToDelete && expenseToDelete.receipt) {
            this.deleteReceipt(expenseToDelete.receipt.id);
        }

        const filtered = expenses.filter(e => e.id !== id);
        return this.save(CONSTANTS.STORAGE_KEYS.FIXED_EXPENSES, filtered);
    },

    /**
     * Obtiene el total de gastos fijos del mes actual
     * @returns {number} Total de gastos fijos
     */
    getTotalFixedExpenses() {
        const { key } = Utils.getCurrentMonthYear();
        return this.getFixedExpenses()
            .filter(e => e.monthKey === key)
            .reduce((sum, e) => sum + Utils.parseNumber(e.amount), 0);
    },

    /**
     * Obtiene el total de gastos fijos pagados del mes actual
     * @returns {number} Total pagado
     */
    getTotalPaidFixedExpenses() {
        const { key } = Utils.getCurrentMonthYear();
        return this.getFixedExpenses()
            .filter(e => e.monthKey === key && e.status === CONSTANTS.EXPENSE_STATUS.PAID)
            .reduce((sum, e) => sum + Utils.parseNumber(e.amount), 0);
    },

    // ==========================================
    // GASTOS SEMANALES
    // ==========================================

    /**
     * Obtiene todos los gastos semanales
     * @returns {Array} Lista de gastos semanales
     */
    getWeeklyExpenses() {
        return this.get(CONSTANTS.STORAGE_KEYS.WEEKLY_EXPENSES, []);
    },

    /**
     * Guarda un nuevo gasto semanal
     * @param {object} expense - Datos del gasto
     * @returns {object} Gasto guardado
     */
    saveWeeklyExpense(expense) {
        const expenses = this.getWeeklyExpenses();
        const newExpense = {
            id: Utils.generateId(),
            ...expense,
            week: expense.week || Utils.getCurrentWeekOfMonth(),
            createdAt: new Date().toISOString()
        };
        expenses.push(newExpense);
        this.save(CONSTANTS.STORAGE_KEYS.WEEKLY_EXPENSES, expenses);
        return newExpense;
    },

    /**
     * Elimina un gasto semanal
     * @param {string} id - ID del gasto
     * @returns {boolean} Éxito de la operación
     */
    deleteWeeklyExpense(id) {
        const expenses = this.getWeeklyExpenses().filter(e => e.id !== id);
        return this.save(CONSTANTS.STORAGE_KEYS.WEEKLY_EXPENSES, expenses);
    },

    /**
     * Obtiene gastos de una semana específica
     * @param {number} week - Número de semana
     * @returns {Array} Gastos de la semana
     */
    getExpensesByWeek(week) {
        const { key } = Utils.getCurrentMonthYear();
        return this.getWeeklyExpenses()
            .filter(e => e.monthKey === key && e.week === week);
    },

    /**
     * Obtiene el total gastado en una semana
     * @param {number} week - Número de semana
     * @returns {number} Total gastado
     */
    getTotalByWeek(week) {
        return this.getExpensesByWeek(week)
            .reduce((sum, e) => sum + Utils.parseNumber(e.amount), 0);
    },

    /**
     * Obtiene el total de gastos semanales del mes actual
     * @returns {number} Total de gastos semanales
     */
    getTotalWeeklyExpenses() {
        const { key } = Utils.getCurrentMonthYear();
        return this.getWeeklyExpenses()
            .filter(e => e.monthKey === key)
            .reduce((sum, e) => sum + Utils.parseNumber(e.amount), 0);
    },

    // ==========================================
    // COMPROBANTES
    // ==========================================

    /**
     * Obtiene todos los comprobantes
     * @returns {Array} Lista de comprobantes
     */
    getReceipts() {
        return this.get(CONSTANTS.STORAGE_KEYS.RECEIPTS, []);
    },

    /**
     * Guarda un comprobante
     * @param {object} receipt - Datos del comprobante
     * @returns {object} Comprobante guardado
     */
    saveReceipt(receipt) {
        const receipts = this.getReceipts();
        const newReceipt = {
            id: Utils.generateId(),
            ...receipt,
            createdAt: new Date().toISOString()
        };
        receipts.push(newReceipt);
        this.save(CONSTANTS.STORAGE_KEYS.RECEIPTS, receipts);
        return newReceipt;
    },

    /**
     * Elimina un comprobante
     * @param {string} id - ID del comprobante
     * @returns {boolean} Éxito de la operación
     */
    deleteReceipt(id) {
        const receipts = this.getReceipts().filter(r => r.id !== id);
        return this.save(CONSTANTS.STORAGE_KEYS.RECEIPTS, receipts);
    },

    /**
     * Obtiene comprobantes de un gasto específico
     * @param {string} expenseId - ID del gasto
     * @returns {Array} Comprobantes del gasto
     */
    getReceiptsByExpense(expenseId) {
        return this.getReceipts().filter(r => r.expenseId === expenseId);
    },

    // ==========================================
    // CÁLCULOS FINANCIEROS
    // ==========================================

    /**
     * Calcula el presupuesto disponible para gastos variables
     * @returns {number} Presupuesto disponible
     */
    getAvailableBudget() {
        const totalIncomes = this.getTotalIncomes();
        const totalFixed = this.getTotalFixedExpenses();
        return totalIncomes - totalFixed;
    },

    /**
     * Calcula el presupuesto semanal
     * @returns {number} Presupuesto por semana
     */
    getWeeklyBudget() {
        const available = this.getAvailableBudget();
        const weeks = Utils.getWeeksOfMonth().length;
        return available / weeks;
    },

    /**
     * Obtiene el resumen financiero del mes
     * @returns {object} Resumen completo
     */
    getFinancialSummary() {
        const totalIncomes = this.getTotalIncomes();
        const totalFixed = this.getTotalFixedExpenses();
        const totalFixedPaid = this.getTotalPaidFixedExpenses();
        const totalWeekly = this.getTotalWeeklyExpenses();
        const availableBudget = this.getAvailableBudget();
        const weeklyBudget = this.getWeeklyBudget();
        const weeks = Utils.getWeeksOfMonth();
        const currentWeek = Utils.getCurrentWeekOfMonth();

        // Calcular excedentes/déficits por semana
        const weeklyData = weeks.map(week => {
            const spent = this.getTotalByWeek(week.number);
            const available = weeklyBudget - spent;
            return {
                ...week,
                budget: weeklyBudget,
                spent,
                available,
                isOver: spent > weeklyBudget,
                isCurrent: week.number === currentWeek
            };
        });

        // Calcular redistribución si hay excedentes
        let carryOver = 0;
        weeklyData.forEach((week, index) => {
            if (index < currentWeek - 1) {
                carryOver += week.available;
            }
        });

        const adjustedWeeklyBudget = weeklyBudget + (carryOver / (weeks.length - currentWeek + 1));

        return {
            totalIncomes,
            totalFixed,
            totalFixedPaid,
            totalFixedPending: totalFixed - totalFixedPaid,
            totalWeekly,
            availableBudget,
            weeklyBudget,
            adjustedWeeklyBudget,
            weeklyData,
            currentWeek,
            totalSpent: totalFixedPaid + totalWeekly,
            balance: totalIncomes - totalFixedPaid - totalWeekly,
            monthKey: Utils.getCurrentMonthYear().key
        };
    },

    // ==========================================
    // UTILIDADES
    // ==========================================

    /**
     * Exporta todos los datos
     * @returns {object} Todos los datos del sistema
     */
    exportAll() {
        return {
            version: CONSTANTS.VERSION,
            exportedAt: new Date().toISOString(),
            data: {
                incomes: this.getIncomes(),
                fixedExpenses: this.getFixedExpenses(),
                weeklyExpenses: this.getWeeklyExpenses(),
                receipts: this.getReceipts()
            }
        };
    },

    /**
     * Importa datos
     * @param {object} data - Datos a importar
     * @returns {boolean} Éxito de la operación
     */
    importAll(data) {
        try {
            if (data.data.incomes) {
                this.save(CONSTANTS.STORAGE_KEYS.INCOMES, data.data.incomes);
            }
            if (data.data.fixedExpenses) {
                this.save(CONSTANTS.STORAGE_KEYS.FIXED_EXPENSES, data.data.fixedExpenses);
            }
            if (data.data.weeklyExpenses) {
                this.save(CONSTANTS.STORAGE_KEYS.WEEKLY_EXPENSES, data.data.weeklyExpenses);
            }
            if (data.data.receipts) {
                this.save(CONSTANTS.STORAGE_KEYS.RECEIPTS, data.data.receipts);
            }
            return true;
        } catch (error) {
            console.error('Storage.importAll error:', error);
            return false;
        }
    }
};

// Exportar
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Storage;
}
