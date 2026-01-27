/**
 * ====================================
 * APP.JS - Controlador Principal
 * Control de Gastos v1.0
 * ====================================
 * Inicializa y coordina todos los módulos del sistema
 */

const App = {
    /**
     * Inicializa la aplicación
     */
    async init() {
        console.log(`🚀 Control de Gastos v${CONSTANTS.VERSION} iniciando...`);

        try {
            // Verificar soporte de localStorage
            this.checkStorageSupport();

            // Inicializar UI
            UI.init();

            // Inicializar módulos
            IncomesModule.init();
            WeeklyModule.init();
            FixedModule.init();
            ReceiptsModule.init();
            PaymentsModule.init();

            // Inicializar inputs de dinero
            Utils.initMoneyInputs();

            // Inicializar selects con iconos
            Utils.initIconSelects();

            // Mostrar fecha completa en header
            this.updateHeaderDate();

            // Actualizar dashboard
            this.updateDashboard();

            // Mostrar recordatorios de vencimientos
            this.checkDueReminders();

            // Mostrar tab inicial
            UI.showTab('dashboard');

            // Inicializar cards clickeables del dashboard
            this.initDashboardCards();

            // Listeners de cambios de mes
            this.initMonthChecker();

            console.log('✅ Aplicación iniciada correctamente');

        } catch (error) {
            console.error('❌ Error al iniciar la aplicación:', error);
            UI.showToast('Error al cargar la aplicación. Por favor, recargá la página.', 'error');
        }
    },

    /**
     * Inicializa las cards clickeables del dashboard
     */
    initDashboardCards() {
        document.querySelectorAll('.stat-card.clickable[data-navigate]').forEach(card => {
            card.addEventListener('click', () => {
                const tabId = card.dataset.navigate;
                if (tabId) {
                    UI.showTab(tabId);
                }
            });
        });
    },

    /**
     * Actualiza la fecha en el header
     */
    updateHeaderDate() {
        const dateDisplay = document.getElementById('current-date-display');
        if (dateDisplay) {
            dateDisplay.textContent = Utils.formatFullDate();
        }
    },

    /**
     * Verifica y muestra recordatorios de vencimientos próximos
     */
    checkDueReminders() {
        const container = document.getElementById('reminders-container');
        if (!container) return;

        const { key } = Utils.getCurrentMonthYear();
        const fixedExpenses = Storage.getFixedExpenses().filter(e => e.monthKey === key);
        const now = new Date();
        const reminders = [];

        fixedExpenses.forEach(expense => {
            if (expense.status === CONSTANTS.EXPENSE_STATUS.PAID) return;
            if (!expense.dueDate) return;

            const dueDate = new Date(expense.dueDate);
            const diffTime = dueDate - now;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays <= 7 && diffDays >= 0) {
                reminders.push({
                    name: expense.name,
                    dueDate: expense.dueDate,
                    diffDays,
                    amount: expense.amount
                });
            } else if (diffDays < 0 && diffDays >= -3) {
                reminders.push({
                    name: expense.name,
                    dueDate: expense.dueDate,
                    diffDays,
                    amount: expense.amount,
                    overdue: true
                });
            }
        });

        if (reminders.length === 0) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = `
            <div class="reminders-card">
                <div class="reminders-header">
                    <i class="bi bi-bell"></i>
                    <span>Recordatorios de vencimientos</span>
                </div>
                <div class="reminders-list">
                    ${reminders.map(r => `
                        <div class="reminder-item ${r.overdue ? 'overdue' : ''}">
                            <div class="reminder-info">
                                <span class="reminder-name">${r.name}</span>
                                <span class="reminder-amount">${Utils.formatCurrency(r.amount)}</span>
                            </div>
                            <div class="reminder-due">
                                ${r.overdue 
                                    ? `<span class="overdue-badge"><i class="bi bi-exclamation-triangle"></i> Vencido hace ${Math.abs(r.diffDays)} día${Math.abs(r.diffDays) !== 1 ? 's' : ''}</span>`
                                    : r.diffDays === 0 
                                        ? `<span class="today-badge"><i class="bi bi-clock"></i> Vence hoy</span>`
                                        : `<span class="due-badge"><i class="bi bi-calendar"></i> Vence en ${r.diffDays} día${r.diffDays !== 1 ? 's' : ''}</span>`
                                }
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    /**
     * Verifica soporte de localStorage
     */
    checkStorageSupport() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
        } catch (e) {
            throw new Error('localStorage no disponible');
        }
    },

    /**
     * Inicializa el verificador de cambio de mes
     */
    initMonthChecker() {
        const currentMonth = Utils.getCurrentMonthYear().key;
        const savedMonth = Storage.get(CONSTANTS.STORAGE_KEYS.CURRENT_MONTH);

        if (savedMonth && savedMonth !== currentMonth) {
            // Nuevo mes detectado
            this.handleNewMonth(savedMonth, currentMonth);
        }

        Storage.save(CONSTANTS.STORAGE_KEYS.CURRENT_MONTH, currentMonth);

        // Verificar cada hora
        setInterval(() => {
            const now = Utils.getCurrentMonthYear().key;
            const saved = Storage.get(CONSTANTS.STORAGE_KEYS.CURRENT_MONTH);
            if (saved !== now) {
                this.handleNewMonth(saved, now);
                Storage.save(CONSTANTS.STORAGE_KEYS.CURRENT_MONTH, now);
            }
        }, 3600000);
    },

    /**
     * Maneja el cambio de mes
     * @param {string} oldMonth - Mes anterior
     * @param {string} newMonth - Mes nuevo
     */
    handleNewMonth(oldMonth, newMonth) {
        UI.showToast(`¡Nuevo mes! Tus datos del mes anterior están guardados.`, 'info');
        this.updateDashboard();
        IncomesModule.render();
        WeeklyModule.render();
        FixedModule.render();
    },

    /**
     * Actualiza el dashboard principal
     */
    updateDashboard() {
        const summary = Storage.getFinancialSummary();
        this.renderDashboardCards(summary);
        this.renderBudgetChart(summary);
        this.renderWeeklyOverview(summary);
    },

    /**
     * Renderiza las tarjetas del dashboard
     * @param {object} summary - Resumen financiero
     */
    renderDashboardCards(summary) {
        // Ingresos totales
        const incomeCard = document.getElementById('card-total-income');
        if (incomeCard) {
            const value = incomeCard.querySelector('.card-value');
            UI.animateNumber(value, 0, summary.totalIncomes);
        }

        // Gastos fijos
        const fixedCard = document.getElementById('card-fixed-expenses');
        if (fixedCard) {
            const value = fixedCard.querySelector('.card-value');
            const progress = fixedCard.querySelector('.mini-progress-fill');
            UI.animateNumber(value, 0, summary.totalFixed);
            if (progress) {
                const pct = Utils.percentage(summary.totalFixedPaid, summary.totalFixed);
                progress.style.width = `${pct}%`;
            }
        }

        // Presupuesto semanal
        const weeklyCard = document.getElementById('card-weekly-budget');
        if (weeklyCard) {
            const value = weeklyCard.querySelector('.card-value');
            UI.animateNumber(value, 0, summary.adjustedWeeklyBudget);
        }

        // Balance
        const balanceCard = document.getElementById('card-balance');
        if (balanceCard) {
            const value = balanceCard.querySelector('.card-value');
            UI.animateNumber(value, 0, summary.balance);
            balanceCard.classList.toggle('negative', summary.balance < 0);
        }
    },

    /**
     * Renderiza el gráfico de presupuesto
     * @param {object} summary - Resumen financiero
     */
    renderBudgetChart(summary) {
        const container = document.getElementById('budget-chart');
        if (!container) return;

        const { totalIncomes, totalFixedPaid, totalFixedPending, totalWeekly, balance } = summary;
        
        // Calcular porcentajes sobre el total de ingresos
        const fixedPaidPct = Utils.percentage(totalFixedPaid, totalIncomes);
        const fixedPendingPct = Utils.percentage(totalFixedPending, totalIncomes);
        const weeklyPct = Utils.percentage(totalWeekly, totalIncomes);
        const availablePct = Utils.percentage(Math.max(balance, 0), totalIncomes);

        // Calcular offsets para el gráfico circular
        const fixedPaidDash = `${fixedPaidPct}, ${100 - fixedPaidPct}`;
        const fixedPendingDash = `${fixedPendingPct}, ${100 - fixedPendingPct}`;
        const weeklyDash = `${weeklyPct}, ${100 - weeklyPct}`;
        const availableDash = `${availablePct}, ${100 - availablePct}`;
        
        const fixedPendingOffset = -fixedPaidPct;
        const weeklyOffset = -(fixedPaidPct + fixedPendingPct);
        const availableOffset = -(fixedPaidPct + fixedPendingPct + weeklyPct);

        container.innerHTML = `
            <div class="chart-container-modern">
                <div class="donut-chart-wrapper">
                    <div class="donut-chart">
                        <svg viewBox="0 0 36 36" class="circular-chart">
                            <path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                            <path class="circle fixed-paid" stroke-dasharray="${fixedPaidDash}" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                            <path class="circle fixed-pending" stroke-dasharray="${fixedPendingDash}" stroke-dashoffset="${fixedPendingOffset}" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                            <path class="circle weekly" stroke-dasharray="${weeklyDash}" stroke-dashoffset="${weeklyOffset}" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                            <path class="circle available" stroke-dasharray="${availableDash}" stroke-dashoffset="${availableOffset}" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        </svg>
                        <div class="chart-center">
                            <span class="chart-label">Ingresos</span>
                            <span class="chart-value">${Utils.formatCurrency(totalIncomes)}</span>
                        </div>
                    </div>
                </div>
                
                <div class="chart-details-grid">
                    <div class="detail-card fixed-paid">
                        <div class="detail-header">
                            <i class="bi bi-check-circle-fill"></i>
                            <span>Fijos Pagados</span>
                        </div>
                        <div class="detail-value">${Utils.formatCurrency(totalFixedPaid)}</div>
                        <div class="detail-pct">${fixedPaidPct}%</div>
                    </div>
                    <div class="detail-card fixed-pending">
                        <div class="detail-header">
                            <i class="bi bi-clock-history"></i>
                            <span>Fijos Pendientes</span>
                        </div>
                        <div class="detail-value">${Utils.formatCurrency(totalFixedPending)}</div>
                        <div class="detail-pct">${fixedPendingPct}%</div>
                    </div>
                    <div class="detail-card weekly">
                        <div class="detail-header">
                            <i class="bi bi-cart-fill"></i>
                            <span>Gastos Variables</span>
                        </div>
                        <div class="detail-value">${Utils.formatCurrency(totalWeekly)}</div>
                        <div class="detail-pct">${weeklyPct}%</div>
                    </div>
                    <div class="detail-card available">
                        <div class="detail-header">
                            <i class="bi bi-piggy-bank-fill"></i>
                            <span>Disponible</span>
                        </div>
                        <div class="detail-value">${Utils.formatCurrency(Math.max(balance, 0))}</div>
                        <div class="detail-pct">${availablePct}%</div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Renderiza el resumen semanal
     * @param {object} summary - Resumen financiero
     */
    renderWeeklyOverview(summary) {
        const container = document.getElementById('weekly-overview');
        if (!container) return;

        container.innerHTML = `
            <div class="weekly-bars">
                ${summary.weeklyData.map(week => {
                    const pct = Math.min(Utils.percentage(week.spent, week.budget), 100);
                    return `
                        <div class="week-bar ${week.isCurrent ? 'current' : ''} ${week.isOver ? 'over' : ''}">
                            <div class="bar-container">
                                <div class="bar-fill" style="height: ${pct}%"></div>
                            </div>
                            <span class="bar-label">S${week.number}</span>
                            <span class="bar-value">${Utils.formatCurrency(week.spent)}</span>
                        </div>
                    `;
                }).join('')}
            </div>
            <div class="weekly-summary-text">
                <p>
                    <strong>Semana actual:</strong> ${summary.currentWeek} de ${summary.weeklyData.length}
                </p>
                <p>
                    <strong>Presupuesto semanal:</strong> ${Utils.formatCurrency(summary.weeklyBudget)}
                    ${summary.adjustedWeeklyBudget !== summary.weeklyBudget ? 
                        `<span class="adjusted">(Ajustado: ${Utils.formatCurrency(summary.adjustedWeeklyBudget)})</span>` : ''
                    }
                </p>
            </div>
        `;
    },

    /**
     * Exporta todos los datos
     */
    exportData() {
        const data = Storage.exportAll();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `control-gastos-backup-${Utils.getCurrentMonthYear().key}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        UI.showToast('Datos exportados correctamente', 'success');
    },

    /**
     * Importa datos desde archivo
     * @param {File} file - Archivo JSON
     */
    async importData(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            if (!data.version || !data.data) {
                throw new Error('Formato de archivo inválido');
            }

            UI.showConfirm(
                'Esto reemplazará todos tus datos actuales. ¿Continuar?',
                () => {
                    Storage.importAll(data);
                    UI.showToast('Datos importados correctamente', 'success');
                    
                    // Recargar todo
                    this.updateDashboard();
                    IncomesModule.render();
                    WeeklyModule.render();
                    FixedModule.render();
                    ReceiptsModule.render();
                }
            );
        } catch (error) {
            console.error('Error importing data:', error);
            UI.showToast('Error al importar datos. Verificá el archivo.', 'error');
        }
    },

    /**
     * Limpia todos los datos
     */
    clearAllData() {
        UI.showConfirm(
            '⚠️ Esto eliminará TODOS tus datos. Esta acción no se puede deshacer. ¿Estás seguro?',
            () => {
                Storage.clear();
                UI.showToast('Todos los datos han sido eliminados', 'success');
                
                // Recargar todo
                this.updateDashboard();
                IncomesModule.render();
                WeeklyModule.render();
                FixedModule.render();
                ReceiptsModule.render();
            }
        );
    }
};

// Iniciar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Exportar
if (typeof module !== 'undefined' && module.exports) {
    module.exports = App;
}
