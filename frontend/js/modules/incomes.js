/**
 * ====================================
 * INCOMES.JS - Módulo de Ingresos
 * Control de Gastos v1.0
 * ====================================
 * Gestiona la lógica de ingresos mensuales
 */

const IncomesModule = {
    /**
     * Inicializa el módulo
     */
    init() {
        this.bindEvents();
        this.render();
    },

    /**
     * Bindea los eventos del módulo
     */
    bindEvents() {
        // Formulario de nuevo ingreso
        const form = document.getElementById('income-form');
        if (form) {
            form.addEventListener('submit', (e) => this.handleSubmit(e));
        }
    },

    /**
     * Maneja el submit del formulario
     * @param {Event} e - Evento submit
     */
    handleSubmit(e) {
        e.preventDefault();
        
        const form = e.target;
        const formData = new FormData(form);
        
        // Parsear monto formateado con separadores de miles
        const rawAmount = formData.get('amount');
        const parsedAmount = Utils.parseFormattedNumber(rawAmount);
        
        const income = {
            description: formData.get('description'),
            amount: parsedAmount,
            monthKey: Utils.getCurrentMonthYear().key
        };

        // Validar
        if (!income.description || income.amount <= 0) {
            UI.showToast('Por favor, completá todos los campos correctamente', 'error');
            return;
        }

        // Guardar
        const saved = Storage.saveIncome(income);
        
        if (saved) {
            UI.showToast('Ingreso agregado correctamente', 'success');
            form.reset();
            this.render();
            
            // Actualizar dashboard y gastos semanales
            if (typeof App !== 'undefined') {
                App.updateDashboard();
                WeeklyModule.updateBudgets();
            }
        } else {
            UI.showToast(CONSTANTS.MESSAGES.ERROR_GENERIC, 'error');
        }
    },

    /**
     * Elimina un ingreso
     * @param {string} id - ID del ingreso
     */
    async delete(id) {
        const confirm = await UI.showConfirm(CONSTANTS.MESSAGES.CONFIRM_DELETE_INCOME);
        if (!confirm) return;

        const deleted = Storage.deleteIncome(id);
        
        if (deleted) {
            UI.showToast('Ingreso eliminado', 'success');
            this.render();
            
            // Actualizar dashboard y gastos semanales
            if (typeof App !== 'undefined') {
                App.updateDashboard();
                WeeklyModule.updateBudgets();
            }
        } else {
            UI.showToast(CONSTANTS.MESSAGES.ERROR_GENERIC, 'error');
        }
    },

    /**
     * Renderiza la lista de ingresos
     */
    render() {
        const container = document.getElementById('incomes-list');
        if (!container) return;

        const { key } = Utils.getCurrentMonthYear();
        const incomes = Storage.getIncomes().filter(i => i.monthKey === key);
        const total = incomes.reduce((sum, i) => sum + Utils.parseNumber(i.amount), 0);

        if (incomes.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="bi bi-wallet2"></i>
                    <p>No hay ingresos registrados este mes</p>
                    <span>Agregá tu primer ingreso usando el formulario</span>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="list-header">
                <span>${incomes.length} ingreso${incomes.length !== 1 ? 's' : ''}</span>
                <span class="total">Total: ${Utils.formatCurrency(total)}</span>
            </div>
            <div class="items-list">
                ${incomes.map(income => this.renderItem(income)).join('')}
            </div>
        `;

        // Bindear eventos de eliminación
        container.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                this.delete(id);
            });
        });
    },

    /**
     * Renderiza un item de ingreso
     * @param {object} income - Datos del ingreso
     * @returns {string} HTML del item
     */
    renderItem(income) {
        return `
            <div class="list-item income-item" data-id="${income.id}">
                <div class="item-icon">
                    <i class="bi bi-cash-stack"></i>
                </div>
                <div class="item-content">
                    <div class="item-title">${income.description}</div>
                    <div class="item-subtitle">${Utils.formatDate(income.createdAt)}</div>
                </div>
                <div class="item-amount positive">
                    ${Utils.formatCurrency(income.amount)}
                </div>
                <div class="item-actions">
                    <button class="action-btn action-btn-delete btn-delete" data-id="${income.id}" title="Eliminar">
                        <i class="bi bi-trash"></i>
                        <span>Eliminar</span>
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Obtiene el total de ingresos
     * @returns {number} Total
     */
    getTotal() {
        return Storage.getTotalIncomes();
    }
};

// Exportar
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IncomesModule;
}
