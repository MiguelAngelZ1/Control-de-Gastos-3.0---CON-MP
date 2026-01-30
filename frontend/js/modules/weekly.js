/**
 * ====================================
 * WEEKLY.JS - Módulo de Gastos Semanales
 * Control de Gastos v1.0
 * ====================================
 * Gestiona la lógica de gastos variables semanales
 */

const WeeklyModule = {
    selectedWeek: null,

    /**
     * Inicializa el módulo
     */
    init() {
        this.selectedWeek = Utils.getCurrentWeekOfMonth();
        this.bindEvents();
        this.render();
    },

    /**
     * Bindea los eventos del módulo
     */
    bindEvents() {
        // Formulario de nuevo gasto
        const form = document.getElementById('weekly-expense-form');
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
        
        const expense = {
            description: formData.get('description'),
            amount: parsedAmount,
            category: formData.get('category') || 'other',
            week: this.selectedWeek,
            monthKey: Utils.getCurrentMonthYear().key
        };

        // Validar
        if (!expense.description || expense.amount <= 0) {
            UI.showToast('Por favor, completá todos los campos correctamente', 'error');
            return;
        }

        // Guardar
        const saved = Storage.saveWeeklyExpense(expense);
        
        if (saved) {
            UI.showToast('Gasto registrado', 'success');
            form.reset();
            this.render();
            
            // Actualizar dashboard
            if (typeof App !== 'undefined') {
                App.updateDashboard();
            }
        } else {
            UI.showToast(CONSTANTS.MESSAGES.ERROR_GENERIC, 'error');
        }
    },

    /**
     * Elimina un gasto
     * @param {string} id - ID del gasto
     */
    async delete(id) {
        const confirm = await UI.showConfirm(CONSTANTS.MESSAGES.CONFIRM_DELETE_EXPENSE);
        if (!confirm) return;

        const deleted = Storage.deleteWeeklyExpense(id);
        
        if (deleted) {
            UI.showToast('Gasto eliminado', 'success');
            this.render();
            
            if (typeof App !== 'undefined') {
                App.updateDashboard();
            }
        } else {
            UI.showToast(CONSTANTS.MESSAGES.ERROR_GENERIC, 'error');
        }
    },

    /**
     * Cambia la semana seleccionada
     * @param {number} week - Número de semana
     */
    selectWeek(week) {
        this.selectedWeek = week;
        this.render();
    },

    /**
     * Actualiza los presupuestos semanales
     */
    updateBudgets() {
        this.render();
    },

    /**
     * Renderiza el módulo completo
     */
    render() {
        this.renderWeekTabs();
        this.renderExpenses();
        this.renderSummary();
    },

    /**
     * Renderiza las pestañas de semanas
     */
    renderWeekTabs() {
        const container = document.getElementById('week-tabs');
        if (!container) return;

        const weeks = Utils.getWeeksOfMonth();
        const summary = Storage.getFinancialSummary();

        container.innerHTML = weeks.map(week => {
            const weekData = summary.weeklyData.find(w => w.number === week.number);
            const isSelected = week.number === this.selectedWeek;
            const isOver = weekData && weekData.isOver;
            const isCurrent = weekData && weekData.isCurrent;

            return `
                <button 
                    class="week-tab ${isSelected ? 'active' : ''} ${isOver ? 'over-budget' : ''} ${isCurrent ? 'current' : ''}"
                    data-week="${week.number}"
                >
                    <span class="week-label">S${week.number}</span>
                    <span class="week-dates">${week.range}</span>
                    ${isCurrent ? '<span class="current-badge">Actual</span>' : ''}
                </button>
            `;
        }).join('');

        // Bindear eventos
        container.querySelectorAll('.week-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const week = parseInt(tab.dataset.week);
                this.selectWeek(week);
            });
        });
    },

    /**
     * Renderiza la lista de gastos de la semana seleccionada
     */
    renderExpenses() {
        const container = document.getElementById('weekly-expenses-list');
        if (!container) return;

        const expenses = Storage.getExpensesByWeek(this.selectedWeek);

        if (expenses.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="bi bi-receipt"></i>
                    <p>No hay gastos en la Semana ${this.selectedWeek}</p>
                    <span>Registrá tus gastos del día a día</span>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="items-list">
                ${expenses.map(expense => this.renderExpenseItem(expense)).join('')}
            </div>
        `;

        // Bindear eventos
        container.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                this.delete(btn.dataset.id);
            });
        });
    },

    /**
     * Renderiza un item de gasto
     * @param {object} expense - Datos del gasto
     * @returns {string} HTML del item
     */
    renderExpenseItem(expense) {
        const category = CONSTANTS.VARIABLE_CATEGORIES.find(c => c.id === expense.category) || 
                        CONSTANTS.VARIABLE_CATEGORIES.find(c => c.id === 'other');

        return `
            <div class="list-item weekly-item" data-id="${expense.id}">
                <div class="item-icon category-${expense.category}">
                    <i class="bi ${category.icon}"></i>
                </div>
                <div class="item-content">
                    <div class="item-title">${expense.description}</div>
                    <div class="item-subtitle">
                        <span class="category-tag">${category.name}</span>
                        <span>${Utils.formatDate(expense.createdAt)}</span>
                    </div>
                </div>
                <div class="item-amount negative">
                    -${Utils.formatCurrency(expense.amount)}
                </div>
                <div class="item-actions">
                    <button class="action-btn action-btn-delete btn-delete" data-id="${expense.id}" title="Eliminar">
                        <i class="bi bi-trash"></i>
                        <span>Eliminar</span>
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Renderiza el resumen de la semana
     */
    renderSummary() {
        const container = document.getElementById('weekly-summary');
        if (!container) return;

        const summary = Storage.getFinancialSummary();
        const weekData = summary.weeklyData.find(w => w.number === this.selectedWeek);

        if (!weekData) {
            container.innerHTML = '';
            return;
        }

        const percentage = Utils.percentage(weekData.spent, weekData.budget);
        const isOver = weekData.isOver;

        container.innerHTML = `
            <div class="summary-card ${isOver ? 'over-budget' : ''}">
                <div class="summary-header">
                    <h4>Semana ${this.selectedWeek}</h4>
                    <span class="summary-range">${weekData.range}</span>
                </div>
                
                <div class="budget-progress">
                    <div class="progress-bar">
                        <div class="progress-fill ${isOver ? 'danger' : ''}" style="width: ${Math.min(percentage, 100)}%"></div>
                    </div>
                    <div class="progress-labels">
                        <span>Gastado: ${Utils.formatCurrency(weekData.spent)}</span>
                        <span>de ${Utils.formatCurrency(weekData.budget)}</span>
                    </div>
                </div>

                <div class="summary-stats">
                    <div class="stat ${isOver ? 'danger' : 'success'}">
                        <span class="stat-label">${isOver ? 'Excedido' : 'Disponible'}</span>
                        <span class="stat-value">${Utils.formatCurrency(Math.abs(weekData.available))}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">% Usado</span>
                        <span class="stat-value">${percentage}%</span>
                    </div>
                </div>

                ${isOver ? `
                    <div class="warning-message">
                        <i class="bi bi-exclamation-triangle"></i>
                        <span>Superaste el presupuesto semanal. El excedente se distribuirá en las semanas restantes.</span>
                    </div>
                ` : ''}

                ${summary.adjustedWeeklyBudget !== summary.weeklyBudget && weekData.isCurrent ? `
                    <div class="info-message">
                        <i class="bi bi-info-circle"></i>
                        <span>Presupuesto ajustado: ${Utils.formatCurrency(summary.adjustedWeeklyBudget)} (incluye excedentes/déficits anteriores)</span>
                    </div>
                ` : ''}
            </div>
        `;
    },

    /**
     * Renderiza el selector de categorías
     * @returns {string} HTML del selector
     */
    renderCategoryOptions() {
        return CONSTANTS.VARIABLE_CATEGORIES.map(cat => `
            <option value="${cat.id}">${cat.name}</option>
        `).join('');
    }
};

// Exportar
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WeeklyModule;
}
