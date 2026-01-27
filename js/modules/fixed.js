/**
 * ====================================
 * FIXED.JS - Módulo de Gastos Fijos
 * Control de Gastos v1.0
 * ====================================
 * Gestiona la lógica de gastos fijos mensuales
 */

const FixedModule = {
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
        // Formulario de nuevo gasto fijo
        const form = document.getElementById('fixed-expense-form');
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
            name: formData.get('name'),
            amount: parsedAmount,
            category: formData.get('category') || 'other',
            dueDate: formData.get('dueDate') || null,
            monthKey: Utils.getCurrentMonthYear().key
        };

        // Validar
        if (!expense.name || expense.amount <= 0) {
            UI.showToast('Por favor, completá todos los campos correctamente', 'error');
            return;
        }

        // Guardar
        const saved = Storage.saveFixedExpense(expense);
        
        if (saved) {
            UI.showToast('Gasto fijo agregado', 'success');
            form.reset();
            this.render();
            
            // Actualizar dashboard y presupuestos semanales
            if (typeof App !== 'undefined') {
                App.updateDashboard();
                WeeklyModule.updateBudgets();
            }
        } else {
            UI.showToast(CONSTANTS.MESSAGES.ERROR_GENERIC, 'error');
        }
    },

    /**
     * Elimina un gasto fijo
     * @param {string} id - ID del gasto
     */
    delete(id) {
        UI.showConfirm(CONSTANTS.MESSAGES.CONFIRM_DELETE_EXPENSE, () => {
            const deleted = Storage.deleteFixedExpense(id);
            
            if (deleted) {
                UI.showToast('Gasto fijo eliminado', 'success');
                this.render();
                
                if (typeof App !== 'undefined') {
                    App.updateDashboard();
                    WeeklyModule.updateBudgets();
                }
            } else {
                UI.showToast(CONSTANTS.MESSAGES.ERROR_GENERIC, 'error');
            }
        });
    },

    /**
     * Abre el modal para cargar factura
     * @param {string} id - ID del gasto
     */
    openInvoiceModal(id) {
        const expense = Storage.getFixedExpenses().find(e => e.id === id);
        if (!expense) return;

        const modal = document.getElementById('invoice-modal');
        const content = modal.querySelector('.modal-body');

        content.innerHTML = `
            <div class="invoice-upload-section">
                <h4>Cargar factura para: ${expense.name}</h4>
                <p class="text-muted">Adjuntá la factura en PDF o imagen para extraer los datos de pago.</p>
                
                <div class="file-upload-area" id="invoice-drop-zone">
                    <input type="file" id="invoice-file-input" accept=".pdf,.jpg,.jpeg,.png,.webp" hidden>
                    <i class="bi bi-cloud-upload"></i>
                    <p>Arrastrá el archivo aquí o hacé clic para seleccionar</p>
                    <span>PDF, JPG, PNG o WebP (máx. 5MB)</span>
                </div>

                <div id="invoice-preview" class="invoice-preview hidden"></div>
                <div id="invoice-data" class="invoice-data hidden"></div>
            </div>
        `;

        // Setup file upload
        this.setupFileUpload(id);

        UI.openModal('invoice-modal');
    },

    /**
     * Configura el upload de archivos
     * @param {string} expenseId - ID del gasto
     */
    setupFileUpload(expenseId) {
        const dropZone = document.getElementById('invoice-drop-zone');
        const fileInput = document.getElementById('invoice-file-input');
        let isDragging = false;

        // Click para seleccionar (solo si no está arrastrando)
        dropZone.addEventListener('click', (e) => {
            if (e.target === fileInput) return;
            if (!isDragging) {
                fileInput.click();
            }
        });

        // Cambio en input
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileUpload(e.target.files[0], expenseId);
            }
            // Limpiar input para permitir seleccionar el mismo archivo
            e.target.value = '';
        });

        // Drag & Drop
        dropZone.addEventListener('dragenter', (e) => {
            e.preventDefault();
            e.stopPropagation();
            isDragging = true;
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            isDragging = true;
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!dropZone.contains(e.relatedTarget)) {
                isDragging = false;
                dropZone.classList.remove('drag-over');
            }
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            isDragging = false;
            dropZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0) {
                this.handleFileUpload(e.dataTransfer.files[0], expenseId);
            }
        });
    },

    /**
     * Maneja la subida de archivo
     * @param {File} file - Archivo subido
     * @param {string} expenseId - ID del gasto
     */
    /**
     * Maneja la subida de archivo
     * @param {File} file - Archivo subido
     * @param {string} expenseId - ID del gasto
     */
    async handleFileUpload(file, expenseId) {
        // Validar archivo
        const validation = Utils.validateFile(file);
        if (!validation.valid) {
            UI.showToast(validation.error, 'error');
            return;
        }

        const dropZone = document.getElementById('invoice-drop-zone');
        const preview = document.getElementById('invoice-preview');
        const dataSection = document.getElementById('invoice-data');

        // Mostrar loading
        dropZone.innerHTML = `
            <div class="loading-spinner"></div>
            <p>${CONSTANTS.MESSAGES.INVOICE_ANALYZING || 'Analizando factura...'}</p>
            <small>Esto puede tomar unos segundos (usando IA)</small>
        `;

        try {
            // Generar FormData para envío a backend
            const formData = new FormData();
            formData.append('invoice', file);

            // Llamada al backend real
            const response = await fetch('/api/invoice/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Error al procesar factura');
            }

            const result = await response.json();
            const invoiceData = result.extracted;

            // Convertir archivo a base64 para preview local (opcional, si se quiere guardar en storage)
            const base64 = await Utils.fileToBase64(file);

            // Mostrar preview
            preview.classList.remove('hidden');
            if (file.type.startsWith('image/')) {
                preview.innerHTML = `<img src="${base64}" alt="Preview de factura">`;
            } else {
                preview.innerHTML = `
                    <div class="pdf-preview">
                        <i class="bi bi-file-earmark-pdf"></i>
                        <span>${file.name}</span>
                    </div>
                `;
            }

            // Mostrar datos extraídos con UI MEJORADA (Payment Summary)
            dataSection.classList.remove('hidden');
            
            // Determinar si hay código de barras
            const hasBarcode = invoiceData.barcode && invoiceData.barcode.length > 5;
            
            dataSection.innerHTML = `
                <div class="extracted-data payment-summary-container">
                    <h5><i class="bi bi-magic"></i> Análisis Inteligente${result.source === 'gemini' ? ' (IA)' : ''}</h5>
                    
                    <div class="amount-card">
                        <span class="label">Monto a Pagar</span>
                        <div class="amount-value">${invoiceData.amountFormatted || '$0.00'}</div>
                        ${invoiceData.dueDateFormatted ? `<span class="due-date">Vence: ${invoiceData.dueDateFormatted}</span>` : ''}
                    </div>

                    <div class="barcode-section">
                        ${hasBarcode ? `
                            <div class="barcode-visual">
                                <svg id="generated-barcode"></svg>
                            </div>
                            <div class="barcode-actions">
                                <div class="barcode-text-group">
                                    <input type="text" value="${invoiceData.barcode}" readonly class="barcode-input" id="barcode-input-readonly">
                                    <button class="btn-icon" id="copy-barcode-btn" title="Copiar código">
                                        <i class="bi bi-clipboard"></i>
                                    </button>
                                </div>
                                <p class="help-text"><i class="bi bi-phone"></i> Escaneá con tu app bancaria o copiá el código</p>
                            </div>
                        ` : `
                            <div class="alert alert-warning">
                                <i class="bi bi-exclamation-triangle"></i> No se detectó código de barras.
                            </div>
                        `}
                    </div>

                    <div class="action-buttons vertical">
                        <button type="button" class="btn btn-primary btn-lg" id="confirm-invoice-btn">
                            <i class="bi bi-check-lg"></i> CONTINUAR CON EL PAGO
                        </button>
                        <button type="button" class="btn btn-text" id="edit-invoice-btn">
                            <i class="bi bi-pencil"></i> Editar datos incorrectos
                        </button>
                    </div>

                    <!-- Campos ocultos/editables (se muestran al editar) -->
                    <div id="manual-edit-fields" class="manual-edit-fields hidden">
                        <div class="data-field">
                            <label>Monto:</label>
                            <input type="number" id="edit-amount" value="${invoiceData.amount || 0}" step="0.01">
                        </div>
                        <div class="data-field">
                            <label>Código:</label>
                            <input type="text" id="edit-barcode" value="${invoiceData.barcode || ''}">
                        </div>
                        <div class="data-field">
                            <label>Vencimiento:</label>
                            <input type="date" id="edit-due" value="${invoiceData.dueDate || ''}">
                        </div>
                    </div>
                </div>
            `;

            // Generar código de barras visual si existe
            if (hasBarcode && typeof JsBarcode !== 'undefined') {
                try {
                    JsBarcode("#generated-barcode", invoiceData.barcode, {
                        format: "CODE128",
                        lineColor: "#000",
                        width: 2,
                        height: 60,
                        displayValue: false,
                        margin: 10
                    });
                } catch (e) {
                    console.error("Error generando barcode:", e);
                }
            }

            // Evento copiar
            const copyBtn = document.getElementById('copy-barcode-btn');
            if (copyBtn) {
                copyBtn.addEventListener('click', () => {
                    const input = document.getElementById('barcode-input-readonly');
                    input.select();
                    document.execCommand('copy'); // Fallback
                    if (navigator.clipboard) navigator.clipboard.writeText(input.value);
                    UI.showToast('Código copiado al portapapeles', 'success');
                });
            }

            // Evento confirmar
            document.getElementById('confirm-invoice-btn').addEventListener('click', () => {
                // Si se editó, usar valores editados
                const finalAmount = parseFloat(document.getElementById('edit-amount').value) || invoiceData.amount;
                const finalBarcode = document.getElementById('edit-barcode').value || invoiceData.barcode;
                const finalDue = document.getElementById('edit-due').value || invoiceData.dueDate;

                this.confirmInvoice(expenseId, {
                    file: base64,
                    fileName: file.name,
                    fileType: file.type,
                    amount: finalAmount,
                    barcode: finalBarcode,
                    dueDate: finalDue,
                    reference: finalBarcode, // Usar barcode como referencia
                    confidence: invoiceData.amountConfidence
                });
            });

            // Evento mostrar edición
            document.getElementById('edit-invoice-btn').addEventListener('click', () => {
                document.getElementById('manual-edit-fields').classList.remove('hidden');
                document.getElementById('edit-invoice-btn').classList.add('hidden');
            });

            // Restaurar dropzone
            dropZone.innerHTML = `
                <i class="bi bi-check-circle text-success"></i>
                <p>Factura procesada</p>
                <span>Hacé clic para cambiar</span>
            `;

        } catch (error) {
            console.error('Error uploading file:', error);
            UI.showToast(error.message || CONSTANTS.MESSAGES.ERROR_GENERIC, 'error');
            
            dropZone.innerHTML = `
                <i class="bi bi-cloud-upload"></i>
                <p>Arrastrá el archivo aquí o hacé clic para seleccionar</p>
                <span>PDF, JPG, PNG o WebP (máx. 5MB)</span>
            `;
        }
    },

    /**
     * Habilita la edición manual de datos extraídos
     */
    enableManualEdit() {
        const inputs = document.querySelectorAll('.extracted-data input');
        inputs.forEach(input => {
            input.removeAttribute('readonly');
            input.classList.add('editable');
        });
        UI.showToast('Podés editar los campos manualmente', 'info');
    },

    /**
     * Confirma los datos de la factura
     * @param {string} expenseId - ID del gasto
     * @param {object} invoiceData - Datos de la factura
     */
    confirmInvoice(expenseId, invoiceData) {
        const updated = Storage.updateFixedExpense(expenseId, {
            status: CONSTANTS.EXPENSE_STATUS.INVOICE_LOADED,
            invoice: invoiceData.file,
            invoiceData: {
                amount: invoiceData.amount,
                barcode: invoiceData.barcode,
                reference: invoiceData.reference,
                dueDate: invoiceData.dueDate,
                fileName: invoiceData.fileName,
                uploadedAt: new Date().toISOString()
            }
        });

        if (updated) {
            UI.showToast(CONSTANTS.MESSAGES.INVOICE_READY, 'success');
            UI.closeModal('invoice-modal');
            this.render();
        } else {
            UI.showToast(CONSTANTS.MESSAGES.ERROR_GENERIC, 'error');
        }
    },

    /**
     * Inicia el proceso de pago
     * @param {string} id - ID del gasto
     */
    async initiatePayment(id) {
        const expense = Storage.getFixedExpenses().find(e => e.id === id);
        if (!expense || !expense.invoiceData) {
            UI.showToast('Primero debés cargar una factura', 'error');
            return;
        }

        // Actualizar estado a "en proceso"
        Storage.updateFixedExpense(id, {
            status: CONSTANTS.EXPENSE_STATUS.PROCESSING
        });
        this.render();

        // Llamar al módulo de pagos
        PaymentsModule.redirectToMercadoPago(expense);
    },

    /**
     * Marca un gasto como pagado
     * @param {string} id - ID del gasto
     */
    markAsPaid(id) {
        UI.openReceiptUploadModal(id, (receiptData) => {
            // Guardar el comprobante SOLO en la colección de receipts (evitar duplicado)
            let savedReceipt = null;
            if (receiptData && receiptData.file) {
                receiptData.expenseId = id;
                savedReceipt = Storage.saveReceipt(receiptData);
            }
            
            // En el gasto fijo solo guardamos la referencia, no el archivo completo
            const updated = Storage.updateFixedExpense(id, {
                status: CONSTANTS.EXPENSE_STATUS.PAID,
                receipt: savedReceipt ? { id: savedReceipt.id, fileName: savedReceipt.fileName } : null,
                paidAt: new Date().toISOString()
            });

            if (updated) {
                UI.showToast('Pago registrado correctamente', 'success');
                this.render();
                
                // Actualizar la galería de comprobantes
                if (typeof ReceiptsModule !== 'undefined') {
                    ReceiptsModule.render();
                }
                
                if (typeof App !== 'undefined') {
                    App.updateDashboard();
                }
            }
        });
    },

    /**
     * Renderiza la lista de gastos fijos
     */
    render() {
        const container = document.getElementById('fixed-expenses-list');
        if (!container) return;

        const { key } = Utils.getCurrentMonthYear();
        const expenses = Storage.getFixedExpenses().filter(e => e.monthKey === key);
        
        // Ordenar: pendientes primero, pagados al final
        expenses.sort((a, b) => {
            const statusOrder = {
                [CONSTANTS.EXPENSE_STATUS.ERROR]: 0,
                [CONSTANTS.EXPENSE_STATUS.PENDING]: 1,
                [CONSTANTS.EXPENSE_STATUS.INVOICE_LOADED]: 2,
                [CONSTANTS.EXPENSE_STATUS.PROCESSING]: 3,
                [CONSTANTS.EXPENSE_STATUS.PAID]: 4
            };
            return statusOrder[a.status] - statusOrder[b.status];
        });

        const total = expenses.reduce((sum, e) => sum + Utils.parseNumber(e.amount), 0);
        const paid = expenses.filter(e => e.status === CONSTANTS.EXPENSE_STATUS.PAID)
                            .reduce((sum, e) => sum + Utils.parseNumber(e.amount), 0);

        if (expenses.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="bi bi-house"></i>
                    <p>No hay gastos fijos registrados</p>
                    <span>Agregá servicios como luz, gas, internet, etc.</span>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="list-header">
                <div class="header-stats">
                    <span>${expenses.length} servicio${expenses.length !== 1 ? 's' : ''}</span>
                    <span class="separator">•</span>
                    <span class="paid">Pagado: ${Utils.formatCurrency(paid)}</span>
                    <span class="separator">•</span>
                    <span class="total">Total: ${Utils.formatCurrency(total)}</span>
                </div>
            </div>
            <div class="items-list fixed-items">
                ${expenses.map(expense => this.renderExpenseItem(expense)).join('')}
            </div>
        `;

        // Bindear eventos
        this.bindItemEvents(container);
    },

    /**
     * Bindea los eventos de los items
     * @param {HTMLElement} container - Contenedor
     */
    bindItemEvents(container) {
        // Botones de cargar factura
        container.querySelectorAll('.btn-upload-invoice').forEach(btn => {
            btn.addEventListener('click', () => this.openInvoiceModal(btn.dataset.id));
        });

        // Botones de pagar
        container.querySelectorAll('.btn-pay').forEach(btn => {
            btn.addEventListener('click', () => this.initiatePayment(btn.dataset.id));
        });

        // Botones de marcar como pagado
        container.querySelectorAll('.btn-mark-paid').forEach(btn => {
            btn.addEventListener('click', () => this.markAsPaid(btn.dataset.id));
        });

        // Botones de ver comprobante
        container.querySelectorAll('.btn-view-receipt').forEach(btn => {
            btn.addEventListener('click', () => {
                const expense = Storage.getFixedExpenses().find(e => e.id === btn.dataset.id);
                if (expense && expense.receipt) {
                    // Buscar el comprobante completo en Storage
                    const receipt = Storage.getReceipts().find(r => r.id === expense.receipt.id);
                    if (receipt) {
                        ReceiptsModule.viewReceipt(receipt);
                    } else {
                        UI.showToast('No se encontró el comprobante', 'error');
                    }
                }
            });
        });

        // Botones de eliminar
        container.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => this.delete(btn.dataset.id));
        });
    },

    /**
     * Renderiza un item de gasto fijo
     * @param {object} expense - Datos del gasto
     * @returns {string} HTML del item
     */
    renderExpenseItem(expense) {
        const category = CONSTANTS.FIXED_CATEGORIES.find(c => c.id === expense.category) || 
                        CONSTANTS.FIXED_CATEGORIES.find(c => c.id === 'other');
        
        const statusLabel = CONSTANTS.STATUS_LABELS[expense.status];
        const statusColor = CONSTANTS.STATUS_COLORS[expense.status];
        const statusIcon = CONSTANTS.STATUS_ICONS[expense.status];
        const isPaid = expense.status === CONSTANTS.EXPENSE_STATUS.PAID;
        const hasInvoice = expense.status !== CONSTANTS.EXPENSE_STATUS.PENDING;
        const canPay = expense.status === CONSTANTS.EXPENSE_STATUS.INVOICE_LOADED;
        const isProcessing = expense.status === CONSTANTS.EXPENSE_STATUS.PROCESSING;

        return `
            <div class="list-item fixed-item ${isPaid ? 'paid' : ''}" data-id="${expense.id}">
                <div class="item-icon category-${expense.category}">
                    <i class="bi ${category.icon}"></i>
                </div>
                
                <div class="item-content">
                    <div class="item-title">${expense.name}</div>
                    <div class="item-subtitle">
                        <span class="status-badge status-${statusColor}">
                            <i class="bi ${statusIcon}"></i>
                            ${statusLabel}
                        </span>
                        ${expense.dueDate ? `<span class="due-date"><i class="bi bi-calendar-event"></i> Vence: ${Utils.formatDate(expense.dueDate)}</span>` : ''}
                    </div>
                </div>
                
                <div class="item-amount ${isPaid ? 'paid' : 'pending'}">
                    ${Utils.formatCurrency(expense.amount)}
                </div>
                
                <div class="item-actions">
                    ${!hasInvoice ? `
                        <button class="action-btn action-btn-upload btn-upload-invoice" data-id="${expense.id}">
                            <i class="bi bi-file-earmark-plus"></i>
                            <span>Cargar factura</span>
                        </button>
                    ` : ''}
                    
                    ${canPay ? `
                        <button class="action-btn action-btn-pay btn-pay" data-id="${expense.id}">
                            <i class="bi bi-credit-card"></i>
                            <span>Pagar</span>
                        </button>
                        <button class="action-btn action-btn-confirm btn-mark-paid" data-id="${expense.id}">
                            <i class="bi bi-check-circle"></i>
                            <span>Ya pagué</span>
                        </button>
                    ` : ''}
                    
                    ${isProcessing ? `
                        <button class="action-btn action-btn-confirm btn-mark-paid" data-id="${expense.id}">
                            <i class="bi bi-check-circle"></i>
                            <span>Confirmar pago</span>
                        </button>
                    ` : ''}
                    
                    ${isPaid && expense.receipt ? `
                        <button class="action-btn action-btn-receipt btn-view-receipt" data-id="${expense.id}">
                            <i class="bi bi-receipt"></i>
                            <span>Ver comprobante</span>
                        </button>
                    ` : ''}
                    
                    <button class="action-btn action-btn-delete btn-delete" data-id="${expense.id}" title="Eliminar">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Renderiza el selector de categorías
     * @returns {string} HTML del selector
     */
    renderCategoryOptions() {
        return CONSTANTS.FIXED_CATEGORIES.map(cat => `
            <option value="${cat.id}">${cat.name}</option>
        `).join('');
    }
};

// Exportar
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FixedModule;
}
