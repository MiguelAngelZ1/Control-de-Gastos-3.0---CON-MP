/**
 * ====================================
 * HISTORY.JS - Módulo de Archivo
 * ====================================
 * Gestiona el archivado de meses y la visualización
 * del historial histórico desde el backend.
 */

const HistoryModule = {
    currentArchive: null,

    init() {
        console.log('📖 HistoryModule inicializado');
        this.renderArchives();
        this.setupEventListeners();
    },

    setupEventListeners() {
        // Botón de Cierre de Mes en Sidebar
        const btnCloseMonth = document.getElementById('btn-close-month');
        if (btnCloseMonth) {
            btnCloseMonth.addEventListener('click', () => this.handleArchiveProcess());
        }

        // Botón Volver al Listado
        const btnBack = document.getElementById('btn-back-to-history');
        if (btnBack) {
            btnBack.addEventListener('click', () => {
                // Forzar visibilidad de la lista y ocultar el detalle
                document.getElementById('history-list-view').style.display = 'block';
                document.getElementById('history-detail-view').style.display = 'none';
                
                UI.updatePageTitle('history');
                HistoryModule.renderArchives();
            });
        }

        // Botón Vaciar Todo
        const btnDeleteAll = document.getElementById('btn-delete-all-archives');
        if (btnDeleteAll) {
            btnDeleteAll.addEventListener('click', () => HistoryModule.handleDeleteAll());
        }
    },

    /**
     * Proceso principal de Cierre de Mes
     */
    async handleArchiveProcess() {
        const summary = Storage.getFinancialSummary();
        
        // Confirmación
        const confirm = await UI.showConfirm(
            `¿Estás seguro de cerrar el mes ${summary.monthKey}?`,
            `Se guardará todo el historial en la base de datos y se limpiará el sistema para el próximo mes. Los nombres de tus gastos fijos se mantendrán.`
        );

        if (!confirm) return;

        try {
            UI.showToast('Archivando mes...', 'info');

            const currentMonthKey = summary.monthKey;

            // IMPORTANTE: Solo archivar datos del mes ACTUAL, no de otros meses
            const fullData = {
                incomes: Storage.getIncomes().filter(i => i.monthKey === currentMonthKey),
                fixedExpenses: Storage.getFixedExpenses().filter(e => e.monthKey === currentMonthKey),
                weeklyExpenses: Storage.getWeeklyExpenses().filter(e => e.monthKey === currentMonthKey),
                receipts: Storage.getReceipts().filter(r => {
                    // Solo incluir comprobantes de gastos fijos del mes actual
                    if (!r.expenseId) return false;
                    const expense = Storage.getFixedExpenses().find(e => e.id === r.expenseId);
                    return expense && expense.monthKey === currentMonthKey;
                })
            };

            console.log(`📦 Archivando mes ${currentMonthKey}:`, {
                ingresos: fullData.incomes.length,
                gastosFijos: fullData.fixedExpenses.length,
                gastosSemanales: fullData.weeklyExpenses.length,
                comprobantes: fullData.receipts.length
            });

            const payload = {
                monthKey: summary.monthKey,
                monthName: Utils.getMonthName(Utils.getCurrentMonthYear().month),
                year: Utils.getCurrentMonthYear().year,
                summary: {
                    totalIncome: summary.totalIncomes,
                    totalExpenses: summary.totalSpent,
                    balance: summary.balance
                },
                fullData: fullData
            };

            // Enviar al servidor usando la nueva capa API
            const result = await API.archiveMonth(payload);

            if (result.success) {
                UI.showToast('¡Mes archivado con éxito!', 'success');
                Storage.resetForNewMonth();
                setTimeout(() => {
                    window.location.reload(true);
                }, 1500);
            }


        } catch (error) {
            UI.showToast(error.message || 'No se pudo completar el cierre de mes.', 'danger');
        }
    },

    /**
     * Renderiza la lista de meses archivados
     */
    async renderArchives() {
        const container = document.getElementById('archives-container');
        if (!container) return;

        try {
            const data = await API.getHistory();

            if (!data.success || data.archives.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="bi bi-archive"></i>
                        <p>No hay meses archivados todavía.</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = '<div class="history-grid"></div>';
            const grid = container.querySelector('.history-grid');

            data.archives.forEach(archive => {
                const card = document.createElement('div');
                card.className = 'history-card clickable';
                card.innerHTML = `
                    <div class="history-card-header">
                        <div class="history-card-icon">
                            <i class="bi bi-calendar-check"></i>
                        </div>
                        <div class="history-card-title">
                            <h4>${archive.month_name} ${archive.year}</h4>
                            <span>Cerrado el ${new Date(archive.created_at).toLocaleDateString()}</span>
                        </div>
                        <button class="btn btn-icon btn-danger-soft btn-sm" onclick="event.stopPropagation(); HistoryModule.handleDeleteMonth(${archive.id}, '${archive.month_name}')" title="Eliminar este mes">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                    
                    <div class="history-card-body">
                        <div class="history-stat-row">
                            <span class="label">Ingresos</span>
                            <span class="value text-success">${Utils.formatCurrency(archive.total_income)}</span>
                        </div>
                        <div class="history-stat-row">
                            <span class="label">Gastos</span>
                            <span class="value text-danger">${Utils.formatCurrency(archive.total_expenses)}</span>
                        </div>
                        <div class="history-stat-row balance-row">
                            <span class="label">Saldo Final</span>
                            <span class="value ${archive.balance >= 0 ? 'text-success' : 'text-danger'}">
                                ${Utils.formatCurrency(archive.balance)}
                            </span>
                        </div>
                    </div>

                    <button class="btn btn-detail-full" onclick="event.stopPropagation(); HistoryModule.viewDetail(${archive.id})">
                        <i class="bi bi-eye"></i> Ver Detalle Completo
                    </button>
                `;
                
                // Hacer la propia tarjeta clickeable
                card.addEventListener('click', () => this.viewDetail(archive.id));
                grid.appendChild(card);
            });

        } catch (error) {
            container.innerHTML = `<p class="text-danger">Error al cargar historial: ${error.message}</p>`;
        }
    },

    /**
     * Muestra la sección de detalle de un mes
     */
    async viewDetail(id) {
        try {
            UI.showToast('Cargando detalles...', 'info');
            const data = await API.getHistoryDetail(id);

            if (!data.success) throw new Error();

            this.currentArchive = data.archive;
            
            // Ocultar lista y mostrar detalle
            document.getElementById('history-list-view').style.display = 'none';
            const detailView = document.getElementById('history-detail-view');
            const detailContent = document.getElementById('history-detail-content');
            detailView.style.display = 'block';
            
            UI.updatePageTitle(`Detalle: ${data.archive.month_name} ${data.archive.year}`);

            this.renderDetailContent(data.archive, detailContent);

        } catch (error) {
            UI.showToast('Error: ' + error.message, 'danger');
        }
    },

    /**
     * Renderiza el contenido del detalle histórico (Dashboard espejo)
     */
    renderDetailContent(archive, container) {
        const full = archive.full_data;
        const summary = archive;

        // Estructura del dashboard histórico
        container.innerHTML = `
            <div class="dashboard-cards mb-6">
                <!-- Incomes -->
                <div class="stat-card income">
                    <div class="stat-card-header">
                        <div class="stat-card-icon"><i class="bi bi-arrow-down-circle"></i></div>
                        <span class="stat-card-label">Ingresos</span>
                    </div>
                    <div class="card-value">${Utils.formatCurrency(summary.total_income)}</div>
                </div>
                <!-- Expenses -->
                <div class="stat-card expense">
                    <div class="stat-card-header">
                        <div class="stat-card-icon"><i class="bi bi-cash-coin"></i></div>
                        <span class="stat-card-label">Gasto Total</span>
                    </div>
                    <div class="card-value">${Utils.formatCurrency(summary.total_expenses)}</div>
                </div>
                <!-- Balance -->
                <div class="stat-card balance">
                    <div class="stat-card-header">
                        <div class="stat-card-icon"><i class="bi bi-piggy-bank"></i></div>
                        <span class="stat-card-label">Resumen Final</span>
                    </div>
                    <div class="card-value">${Utils.formatCurrency(summary.balance)}</div>
                </div>
            </div>

            <!-- 1. Lista de Ingresos de ese mes -->
            <div class="card mb-6">
                <div class="card-header"><h3 class="card-title"><i class="bi bi-plus-circle"></i> Ingresos Detallados</h3></div>
                <div class="items-list">
                    ${full.incomes.map(i => `
                        <div class="list-item">
                            <div class="item-icon-circle income-icon">
                                <i class="bi bi-cash-stack"></i>
                            </div>
                            <div class="item-content">
                                <div class="item-title">${i.description}</div>
                            </div>
                            <div class="item-amount positive">${Utils.formatCurrency(i.amount)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- 2. Lista de Gastos Fijos de ese mes -->
            <div class="card mb-6">
                <div class="card-header"><h3 class="card-title"><i class="bi bi-house"></i> Gastos Fijos</h3></div>
                <div class="items-list">
                    ${full.fixedExpenses.map(e => {
                        const category = CONSTANTS.FIXED_CATEGORIES.find(c => c.id === e.category) || { icon: 'bi-question-circle' };
                        return `
                        <div class="list-item ${e.status === 'paid' ? 'paid' : ''}">
                            <div class="item-icon-circle">
                                <i class="bi ${category.icon}"></i>
                            </div>
                            <div class="item-content">
                                <div class="item-title">${e.name}</div>
                                <div class="item-subtitle">${Utils.getMonthName(Utils.parseMonth(e.monthKey))} ${e.dueDate ? '• Vence ' + e.dueDate : ''}</div>
                            </div>
                            <div class="item-amount ${e.status === 'paid' ? 'positive' : 'negative'}">
                                ${Utils.formatCurrency(e.amount)}
                            </div>
                            ${e.receipt ? `<button class="action-btn action-btn-receipt" onclick="HistoryModule.viewReceipt('${e.receipt.id}')"><i class="bi bi-file-earmark-text"></i></button>` : ''}
                        </div>
                    `}).join('')}
                </div>
            </div>
            
            <!-- 3. Gastos Semanales -->
            <div class="card mb-6">
                <div class="card-header"><h3 class="card-title"><i class="bi bi-calendar-week"></i> Gastos Semanales</h3></div>
                <div class="items-list">
                    ${full.weeklyExpenses.map(e => {
                        const category = CONSTANTS.VARIABLE_CATEGORIES.find(c => c.id === e.category) || { icon: 'bi-question-circle' };
                        return `
                        <div class="list-item">
                            <div class="item-icon-circle weekly-icon">
                                <i class="bi ${category.icon}"></i>
                            </div>
                            <div class="item-content">
                                <div class="item-title">${e.description}</div>
                                <div class="item-subtitle">Semana ${e.week} • ${category.name}</div>
                            </div>
                            <div class="item-amount negative">${Utils.formatCurrency(e.amount)}</div>
                        </div>
                    `}).join('')}
                </div>
            </div>
        `;
    },

    /**
     * Auxiliar para visualizar comprobantes desde el historial
     */
    viewReceipt(receiptId) {
        if (!this.currentArchive) return;
        const receipt = this.currentArchive.full_data.receipts.find(r => r.id === receiptId);
        
        if (receipt) {
            const fileData = receipt.file || receipt.data; // Compatibilidad por si acaso
            const fileType = receipt.fileType || (fileData && fileData.startsWith('data:application/pdf') ? 'application/pdf' : 'image/jpeg');

            // Si es un PDF
            if (fileType === 'application/pdf' || (fileData && fileData.startsWith('data:application/pdf'))) {
                try {
                    const pdfWindow = window.open("");
                    if (pdfWindow) {
                        pdfWindow.document.write(
                            `<html><head><title>Comprobante: ${receipt.fileName || 'PDF'}</title></head><body style="margin:0"><iframe width='100%' height='100%' src='${fileData}' frameborder='0'></iframe></body></html>`
                        );
                    } else {
                        UI.showToast('Por favor permite las ventanas emergentes', 'warning');
                    }
                } catch (e) {
                    console.error('Error al abrir PDF:', e);
                }
            } else {
                // Si es imagen, abrir en el modal habitual
                const modal = document.getElementById('view-receipt-modal');
                if (modal) {
                    const title = modal.querySelector('.modal-title');
                    const body = modal.querySelector('.modal-body');
                    
                    if (title) title.textContent = `Comprobante: ${receipt.fileName || receipt.name || 'Imagen'}`;
                    if (body) {
                        body.innerHTML = `
                            <div class="receipt-viewer-container">
                                <img src="${fileData}" alt="Comprobante">
                            </div>
                        `;
                    }
                    UI.openModal('view-receipt-modal');
                }
            }
        } else {
            UI.showToast('No se encontró el comprobante en este archivo', 'warning');
        }
    },

    /**
     * Elimina un mes del historial
     */
    async handleDeleteMonth(id, name) {
        const confirm = await UI.showConfirm(
            `¿Estás seguro de eliminar el historial de ${name}?`,
            'Esta acción eliminará el registro del archivo Y todos los datos de ese mes del sistema. Es permanente.',
            {
                confirmText: 'Sí, eliminar todo',
                cancelText: 'Cancelar'
            }
        );
        
        if (confirm) {
            try {
                // Primero obtener el monthKey del archivo antes de eliminarlo
                const data = await API.getHistoryDetail(id);
                const monthKey = data.archive?.month_key;

                // Eliminar del historial (base de datos)
                await API.deleteHistoryItem(id);

                // Limpiar datos del localStorage para ese mes
                if (monthKey) {
                    Storage.clearMonthData(monthKey);
                    console.log(`✅ Datos del mes ${monthKey} eliminados del localStorage`);
                }

                UI.showToast('Historial y datos del mes eliminados correctamente', 'success');
                
                // Recargar la página para refrescar la UI completamente
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            } catch (error) {
                console.error('Error al eliminar:', error);
                UI.showToast('Hubo un problema al intentar eliminar el registro.', 'error');
            }
        }
    },

    /**
     * Vacía todo el archivo
     */
    async handleDeleteAll() {
        const confirm = await UI.showConfirm(
            `⚠️ ¡ATENCIÓN! Vas a borrar TODO el historial permanentemente.`,
            'Esto eliminará todos los registros archivados Y sus datos del sistema. ¿Deseas continuar?',
            {
                confirmText: 'Sí, eliminar TODO',
                cancelText: 'Cancelar'
            }
        );
        
        if (confirm) {
            try {
                // Obtener todos los archivos para limpiar sus datos
                const data = await API.getHistory();
                const monthKeys = data.archives?.map(archive => archive.month_key) || [];

                // Eliminar todos los archivos del historial
                await API.clearAllHistory();

                // Limpiar datos de todos los meses del localStorage
                monthKeys.forEach(monthKey => {
                    if (monthKey) {
                        Storage.clearMonthData(monthKey);
                    }
                });

                UI.showToast('Archivo e historial completo eliminados correctamente', 'success');
                
                // Recargar la página para refrescar la UI completamente
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            } catch (error) {
                console.error('Error al vaciar:', error);
                UI.showToast('No se pudo vaciar el archivo por completo.', 'error');
            }
        }
    }
};

// Exponer globalmente para onclick
window.HistoryModule = HistoryModule;
