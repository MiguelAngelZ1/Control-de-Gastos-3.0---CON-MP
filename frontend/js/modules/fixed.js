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
            
            // Preguntar si tiene factura
            setTimeout(async () => {
                const hasInvoice = await UI.showConfirm(
                    '¿Este servicio tiene factura?', 
                    'Si tiene factura, podrás escanear el código de barras para pagar.',
                    {
                        confirmText: 'SÍ, tiene factura',
                        cancelText: 'NO, no tiene factura'
                    }
                );
                
                if (hasInvoice) {
                    Storage.updateFixedExpense(saved.id, { hasInvoice: true });
                } else {
                    Storage.updateFixedExpense(saved.id, { 
                        hasInvoice: false,
                        status: CONSTANTS.EXPENSE_STATUS.PENDING 
                    });
                }
                this.render();
            }, 500);

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

    async delete(id) {
        const confirm = await UI.showConfirm(CONSTANTS.MESSAGES.CONFIRM_DELETE_EXPENSE);
        if (!confirm) return;

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
    },

    /**
     * Edita el nombre de un gasto fijo
     */
    async editName(id) {
        const expense = Storage.getFixedExpenses().find(e => e.id === id);
        if (!expense) return;

        const newName = prompt('Editar nombre del servicio:', expense.name);
        if (newName && newName.trim() !== "" && newName !== expense.name) {
            Storage.updateFixedExpense(id, { name: newName.trim() });
            UI.showToast('Nombre actualizado', 'success');
            this.render();
        }
    },

    /**
     * Abre el modal para cargar factura (Ventana 1)
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
     * Maneja la subida de archivo y muestra el spinner (Ventana 2)
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

        const modal = document.getElementById('invoice-modal');
        const content = modal.querySelector('.modal-body');

        // Mostrar Ventana 2: Spinner de carga
        content.innerHTML = `
            <div class="invoice-analyzing-section text-center py-5">
                <div class="loading-spinner mb-4"></div>
                <h4>Analizando factura...</h4>
                <p class="text-muted">Nuestra IA Gemini está extrayendo los datos de pago.</p>
                <small class="text-info"><i class="bi bi-info-circle"></i> Esto puede tomar unos segundos</small>
            </div>
        `;

        try {
            // Generar FormData para envío a backend
            const formData = new FormData();
            formData.append('invoice', file);

            // Llamada al backend real usando la vía profesional API
            const result = await API.uploadInvoice(formData);
            const invoiceData = result.extracted;

            // Convertir archivo a base64 para preview local
            const base64 = await Utils.fileToBase64(file);

            // Mostrar Ventana 3: Resultados de la extracción
            this.showExtractionResults(expenseId, invoiceData, base64, file);

        } catch (error) {
            console.error('Error uploading invoice:', error);
            UI.showToast(error.message || 'No se pudo procesar el comprobante. Verifique la conexión o el formato del archivo.', 'error');
            this.openInvoiceModal(expenseId); // Volver al inicio si falla
        }
    },

    /**
     * Muestra los resultados de la extracción (Ventana 3)
     * @param {string} expenseId - ID del gasto
     * @param {object} invoiceData - Datos extraídos
     * @param {string} base64 - Archivo en base64
     * @param {File} file - Archivo original
     */
    showExtractionResults(expenseId, invoiceData, base64, file) {
        const modal = document.getElementById('invoice-modal');
        const content = modal.querySelector('.modal-body');
        
        // Determinar si hay código de barras
        const hasBarcode = invoiceData.barcode && invoiceData.barcode.length > 5;
        
        content.innerHTML = `
            <div class="extraction-container">
                <div class="extraction-success-header">
                    <div class="success-icon">
                        <i class="bi bi-check-all"></i>
                    </div>
                    <div class="success-text">
                        <h3>¡Extracción exitosa!</h3>
                        <p>Verificá los datos extraídos por la IA antes de continuar.</p>
                    </div>
                </div>

                <div class="data-display-modern">
                    <div class="data-row">
                        <div class="data-field">
                            <span class="label">EMPRESA</span>
                            <span class="value" id="display-provider">${invoiceData.provider?.name || (typeof invoiceData.provider === 'string' ? invoiceData.provider : null) || invoiceData.providerName || 'No identificada'}</span>
                        </div>
                        <div class="data-field">
                            <span class="label">TITULAR</span>
                            <span class="value" id="display-titular">${invoiceData.titular || invoiceData.customerName || 'No detectado'}</span>
                        </div>
                    </div>
                    <div class="data-row highlight-row">
                        <div class="data-field">
                            <span class="label">MONTO A PAGAR</span>
                            <span class="value amount" id="display-amount">${invoiceData.amountFormatted || Utils.formatCurrency(invoiceData.amount)}</span>
                        </div>
                        <div class="data-field">
                            <span class="label">VENCIMIENTO</span>
                            <span class="value date" id="display-due">${invoiceData.dueDateFormatted || (invoiceData.dueDate ? Utils.formatDate(invoiceData.dueDate) : 'No detectado')}</span>
                        </div>
                    </div>
                </div>

                <div class="barcode-modern-section">
                    ${hasBarcode ? `
                        <div class="barcode-header">
                            <i class="bi bi-upc-scan"></i>
                            <span>Código de Barras para Pago</span>
                        </div>
                        <div class="barcode-visual-container">
                            <div class="barcode-svg-wrapper">
                                <svg id="generated-barcode"></svg>
                            </div>
                        </div>
                        <div class="barcode-copy-wrapper">
                            <input type="text" class="barcode-input-modern" id="barcode-input-readonly" value="${invoiceData.barcode}" readonly>
                            <button class="copy-btn-modern" id="copy-barcode-btn" title="Copiar código">
                                <i class="bi bi-copy"></i>
                                <span>Copiar</span>
                            </button>
                        </div>
                        <p class="barcode-hint">
                            <i class="bi bi-info-circle"></i>
                            Escaneá desde <strong>Mercado Pago</strong> o copiá el número para tu billetera virtual.
                        </p>
                    ` : `
                        <div class="alert alert-warning">
                            <i class="bi bi-exclamation-triangle"></i>
                            <span>No se detectó código de barras para pago electrónico.</span>
                        </div>
                    `}
                </div>

                <div class="extraction-actions">
                    <button class="btn-pay-now" id="confirm-payment-btn">
                        <i class="bi bi-credit-card-fill"></i>
                        YA PAGUÉ, CARGAR COMPROBANTE
                    </button>
                    
                    <div class="secondary-actions">
                        <button class="btn-secondary-outline" id="edit-invoice-btn">
                            <i class="bi bi-pencil-square"></i>
                            EDITAR DATOS
                        </button>
                        <button class="btn-secondary-outline" id="pay-later-btn">
                            <i class="bi bi-clock-history"></i>
                            PAGAR LUEGO
                        </button>
                    </div>
                </div>

                <div id="manual-edit-fields" class="manual-edit-fields-modern hidden">
                    <h4>Corregir datos</h4>
                    <div class="edit-grid">
                        <div class="form-group">
                            <label>Empresa</label>
                            <input type="text" id="edit-provider" value="${invoiceData.provider?.name || invoiceData.provider || ''}">
                        </div>
                        <div class="form-group">
                            <label>Titular</label>
                            <input type="text" id="edit-customer" value="${invoiceData.customerName || invoiceData.titular || ''}">
                        </div>
                        <div class="form-group">
                            <label>Monto</label>
                            <input type="number" id="edit-amount" value="${invoiceData.amount || 0}" step="0.01">
                        </div>
                        <div class="form-group">
                            <label>Vencimiento</label>
                            <input type="date" id="edit-due" value="${invoiceData.dueDate || ''}">
                        </div>
                        <div class="form-group full-width">
                            <label>Código de Barras</label>
                            <input type="text" id="edit-barcode" value="${invoiceData.barcode || ''}">
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Generar código de barras visual (MANTENIENDO LÓGICA ORIGINAL)
        if (hasBarcode && typeof JsBarcode !== 'undefined') {
            try {
                const barcodeValue = invoiceData.barcode.replace(/\s/g, '');
                const barcodeLength = barcodeValue.length;
                let barcodeConfig = {
                    format: "CODE128",
                    lineColor: "#000000",
                    background: "#ffffff",
                    height: 65, // Aumentado para mejor visibilidad
                    displayValue: true,
                    fontSize: 11,
                    margin: 10,
                    textMargin: 5,
                    width: 2.0 // Aumentado para ocupar más largo
                };
                
                // Ajuste dinámico basado en longitud para maximizar el ancho sin desbordar
                if (barcodeLength >= 55) { 
                    barcodeConfig.width = 1.1; 
                    barcodeConfig.fontSize = 8; 
                    barcodeConfig.height = 55; 
                    barcodeConfig.displayValue = false; 
                }
                else if (barcodeLength >= 50) { 
                    barcodeConfig.width = 1.2; 
                    barcodeConfig.fontSize = 9; 
                    barcodeConfig.height = 60; 
                }
                else if (barcodeLength >= 45) { 
                    barcodeConfig.width = 1.4; 
                    barcodeConfig.fontSize = 10; 
                    barcodeConfig.height = 65; 
                }
                else if (barcodeLength >= 40) { 
                    barcodeConfig.width = 1.6; 
                    barcodeConfig.fontSize = 10; 
                }
                
                JsBarcode("#generated-barcode", barcodeValue, barcodeConfig);
            } catch (e) {
                console.error("Error generando barcode:", e);
            }
        }

        // Eventos
        document.getElementById('copy-barcode-btn')?.addEventListener('click', () => {
            const input = document.getElementById('barcode-input-readonly');
            input.select();
            if (navigator.clipboard) navigator.clipboard.writeText(input.value);
            UI.showToast('Código copiado', 'success');
        });

        document.getElementById('edit-invoice-btn').addEventListener('click', () => {
            document.getElementById('manual-edit-fields').classList.toggle('hidden');
        });

        document.getElementById('pay-later-btn').addEventListener('click', () => {
            // Guardar datos pero mantener pendiente
            this.saveInvoiceData(expenseId, invoiceData, base64, file, CONSTANTS.EXPENSE_STATUS.INVOICE_LOADED);
            UI.closeModal('invoice-modal');
            UI.showToast('Datos guardados. Podés pagar luego desde la lista.', 'info');
        });

        document.getElementById('confirm-payment-btn').addEventListener('click', () => {
            // Guardar datos y pasar a carga de comprobante
            const finalData = {
                ...invoiceData,
                amount: parseFloat(document.getElementById('edit-amount').value) || invoiceData.amount,
                barcode: document.getElementById('edit-barcode').value || invoiceData.barcode,
                dueDate: document.getElementById('edit-due').value || invoiceData.dueDate,
                providerName: document.getElementById('edit-provider').value || invoiceData.provider?.name || invoiceData.provider,
                customerName: document.getElementById('edit-customer')?.value || invoiceData.customerName || invoiceData.titular
            };
            
            this.saveInvoiceData(expenseId, finalData, base64, file, CONSTANTS.EXPENSE_STATUS.PROCESSING);
            UI.closeModal('invoice-modal');
            
            // Abrir modal de comprobante inmediatamente
            setTimeout(() => {
                this.markAsPaid(expenseId);
            }, 300);
        });
    },

    /**
     * Guarda los datos de la factura en el storage
     */
    saveInvoiceData(expenseId, invoiceData, base64, file, status) {
        Storage.updateFixedExpense(expenseId, {
            status: status,
            invoice: base64,
            invoiceData: {
                amount: invoiceData.amount,
                barcode: invoiceData.barcode,
                dueDate: invoiceData.dueDate,
                providerName: invoiceData.providerName || invoiceData.provider?.name || invoiceData.provider,
                customerName: invoiceData.customerName || invoiceData.titular,
                fileName: file.name,
                uploadedAt: new Date().toISOString()
            }
        });
        this.render();
    },

    /**
     * Marca un gasto como pagado y pide comprobante (Ventana 4)
     * @param {string} id - ID del gasto
     */
    markAsPaid(id) {
        UI.openReceiptUploadModal(id, (receiptData) => {
            if (!receiptData) {
                // Si cancela la carga del comprobante, volvemos al estado anterior o dejamos en procesamiento
                UI.showToast('Debés cargar el comprobante para finalizar', 'warning');
                return;
            }

            // Guardar el comprobante
            receiptData.expenseId = id;
            const savedReceipt = Storage.saveReceipt(receiptData);
            
            // Actualizar el gasto fijo a PAGADO
            const updated = Storage.updateFixedExpense(id, {
                status: CONSTANTS.EXPENSE_STATUS.PAID,
                receipt: savedReceipt ? { id: savedReceipt.id, fileName: savedReceipt.fileName } : null,
                paidAt: new Date().toISOString()
            });

            if (updated) {
                UI.showToast('¡Servicio pagado con éxito!', 'success');
                this.render();
                
                if (typeof ReceiptsModule !== 'undefined') ReceiptsModule.render();
                if (typeof App !== 'undefined') App.updateDashboard();
            }
        });
    },

    /**
     * Inicia el proceso de pago para servicios con factura ya cargada
     */
    initiatePayment(id) {
        const expense = Storage.getFixedExpenses().find(e => e.id === id);
        if (!expense || !expense.invoiceData) return;
        
        // Re-mostrar la ventana de resultados para proceder al pago
        this.showExtractionResults(id, {
            ...expense.invoiceData,
            amountFormatted: Utils.formatCurrency(expense.invoiceData.amount),
            dueDateFormatted: Utils.formatDate(expense.invoiceData.dueDate),
            provider: { name: expense.invoiceData.providerName }
        }, expense.invoice, { name: expense.invoiceData.fileName });
        
        UI.openModal('invoice-modal');
    },

    /**
     * Renderiza la lista de gastos fijos
     */
    render() {
        const container = document.getElementById('fixed-expenses-list');
        if (!container) return;

        const { key } = Utils.getCurrentMonthYear();
        const expenses = Storage.getFixedExpenses().filter(e => e.monthKey === key);
        
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

        this.bindItemEvents(container);
    },

    /**
     * Bindea los eventos de los items
     */
    bindItemEvents(container) {
        container.querySelectorAll('.btn-upload-invoice').forEach(btn => {
            btn.addEventListener('click', () => this.openInvoiceModal(btn.dataset.id));
        });

        container.querySelectorAll('.btn-pay-no-invoice').forEach(btn => {
            btn.addEventListener('click', () => this.markAsPaid(btn.dataset.id));
        });

        container.querySelectorAll('.btn-pay').forEach(btn => {
            btn.addEventListener('click', () => this.initiatePayment(btn.dataset.id));
        });

        container.querySelectorAll('.btn-view-receipt').forEach(btn => {
            btn.addEventListener('click', () => {
                const expense = Storage.getFixedExpenses().find(e => e.id === btn.dataset.id);
                if (expense && expense.receipt) {
                    const receipt = Storage.getReceipts().find(r => r.id === expense.receipt.id);
                    if (receipt) ReceiptsModule.viewReceipt(receipt);
                }
            });
        });

        container.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => this.delete(btn.dataset.id));
        });

        container.querySelectorAll('.btn-edit-name').forEach(btn => {
            btn.addEventListener('click', () => this.editName(btn.dataset.id));
        });
    },

    /**
     * Renderiza un item de gasto fijo
     */
    renderExpenseItem(expense) {
        const category = CONSTANTS.FIXED_CATEGORIES.find(c => c.id === expense.category) || 
                        CONSTANTS.FIXED_CATEGORIES.find(c => c.id === 'other');
        
        const statusLabel = CONSTANTS.STATUS_LABELS[expense.status];
        const statusColor = CONSTANTS.STATUS_COLORS[expense.status];
        const statusIcon = CONSTANTS.STATUS_ICONS[expense.status];
        const isPaid = expense.status === CONSTANTS.EXPENSE_STATUS.PAID;
        const isPending = expense.status === CONSTANTS.EXPENSE_STATUS.PENDING;
        const isLoaded = expense.status === CONSTANTS.EXPENSE_STATUS.INVOICE_LOADED;
        const hasInvoice = expense.hasInvoice !== false; // Default true

        return `
            <div class="list-item fixed-item ${isPaid ? 'paid' : ''}" data-id="${expense.id}">
                <div class="item-icon category-${expense.category}">
                    <i class="bi ${category.icon}"></i>
                </div>
                
                <div class="item-content">
                    <div class="item-title" style="display: flex; align-items: center; gap: 8px;">
                        ${expense.name}
                        <button class="btn-edit-name" data-id="${expense.id}" style="font-size: 0.8rem; color: var(--text-muted); padding: 0 4px; border-radius: 4px; background: var(--bg-hover);">
                            <i class="bi bi-pencil"></i>
                        </button>
                    </div>
                    <div class="item-subtitle">
                        <span class="status-badge status-${statusColor}">
                            <i class="bi ${statusIcon}"></i>
                            ${statusLabel}
                        </span>
                        ${expense.dueDate ? `<span class="due-date"><i class="bi bi-calendar-event"></i> Vence: ${Utils.formatDate(expense.dueDate)}</span>` : ''}
                        ${!hasInvoice ? `<span class="no-invoice-badge"><i class="bi bi-file-earmark-x"></i> Sin factura</span>` : ''}
                    </div>
                </div>
                
                <div class="item-amount ${isPaid ? 'paid' : 'pending'}">
                    ${Utils.formatCurrency(expense.amount)}
                </div>
                
                <div class="item-actions">
                    ${isPending && hasInvoice ? `
                        <button class="action-btn action-btn-upload btn-upload-invoice" data-id="${expense.id}">
                            <i class="bi bi-file-earmark-plus"></i>
                            <span>Cargar factura</span>
                        </button>
                    ` : ''}

                    ${isPending && !hasInvoice ? `
                        <button class="action-btn action-btn-pay btn-pay-no-invoice" data-id="${expense.id}">
                            <i class="bi bi-credit-card"></i>
                            <span>Pagar</span>
                        </button>
                    ` : ''}
                    
                    ${isLoaded ? `
                        <button class="action-btn action-btn-pay btn-pay" data-id="${expense.id}">
                            <i class="bi bi-credit-card"></i>
                            <span>Pagar</span>
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
    }
};

// Exportar
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FixedModule;
}
