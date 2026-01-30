/**
 * ====================================
 * RECEIPTS.JS - Módulo de Comprobantes
 * Control de Gastos v1.0
 * ====================================
 * Gestiona la visualización y almacenamiento de comprobantes
 * PDFs se abren en nueva pestaña, imágenes en modal con zoom
 */

const ReceiptsModule = {
    // Variables para el zoom
    currentZoom: 100,

    /**
     * Inicializa el módulo
     */
    init() {
        this.render();
    },

    /**
     * Abre el modal para subir comprobante
     * @param {string} expenseId - ID del gasto
     * @param {Function} callback - Callback con los datos del comprobante
     */
    openUploadModal(expenseId, callback) {
        const modal = document.getElementById('receipt-modal');
        const content = modal.querySelector('.modal-body');

        content.innerHTML = `
            <div class="receipt-upload-section">
                <h4>Adjuntar comprobante de pago</h4>
                <p class="text-muted">Subí el comprobante del pago realizado para tener un registro.</p>
                
                <div class="file-upload-area" id="receipt-drop-zone">
                    <input type="file" id="receipt-file-input" accept=".pdf,.jpg,.jpeg,.png,.webp" hidden>
                    <i class="bi bi-cloud-upload"></i>
                    <p>Arrastrá el archivo aquí o hacé clic para seleccionar</p>
                    <span>PDF, JPG, PNG o WebP (máx. 5MB)</span>
                </div>

                <div id="receipt-preview" class="receipt-preview hidden"></div>

                <div class="form-group mt-3">
                    <label for="receipt-notes">Notas (opcional)</label>
                    <textarea id="receipt-notes" class="form-control" rows="2" placeholder="Agregar notas sobre el pago..."></textarea>
                </div>

                <div class="action-buttons mt-3">
                    <button type="button" class="btn btn-primary" id="save-receipt-btn" disabled>
                        <i class="bi bi-check-lg"></i> Guardar comprobante
                    </button>
                    <button type="button" class="btn btn-secondary" id="skip-receipt-btn">
                        <i class="bi bi-x-lg"></i> Omitir
                    </button>
                </div>
            </div>
        `;

        let receiptData = null;
        let isDragging = false;

        const dropZone = document.getElementById('receipt-drop-zone');
        const fileInput = document.getElementById('receipt-file-input');
        const saveBtn = document.getElementById('save-receipt-btn');
        const skipBtn = document.getElementById('skip-receipt-btn');
        const preview = document.getElementById('receipt-preview');

        // Click para seleccionar archivo - solo si no está arrastrando
        dropZone.addEventListener('click', (e) => {
            // Solo abrir el explorador si no estamos arrastrando
            if (!isDragging && e.target !== fileInput) {
                fileInput.click();
            }
        });

        // Cambio en input de archivo
        fileInput.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                receiptData = await this.processFile(e.target.files[0], preview, dropZone);
                if (receiptData) {
                    saveBtn.removeAttribute('disabled');
                }
            }
            // Limpiar el input para permitir seleccionar el mismo archivo de nuevo
            e.target.value = '';
        });

        // Drag & Drop - marcar que estamos arrastrando
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
            // Solo quitar la clase si realmente salimos del dropzone
            if (!dropZone.contains(e.relatedTarget)) {
                isDragging = false;
                dropZone.classList.remove('drag-over');
            }
        });

        dropZone.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            isDragging = false;
            dropZone.classList.remove('drag-over');
            
            if (e.dataTransfer.files.length > 0) {
                receiptData = await this.processFile(e.dataTransfer.files[0], preview, dropZone);
                if (receiptData) {
                    saveBtn.removeAttribute('disabled');
                }
            }
        });

        // Guardar
        saveBtn.addEventListener('click', () => {
            if (receiptData) {
                const notes = document.getElementById('receipt-notes').value;
                receiptData.notes = notes;
                receiptData.expenseId = expenseId;
                
                callback(receiptData);
                UI.closeModal('receipt-modal');
            }
        });

        // Omitir
        skipBtn.addEventListener('click', () => {
            callback(null);
            UI.closeModal('receipt-modal');
        });

        UI.openModal('receipt-modal');
    },

    /**
     * Procesa un archivo de comprobante
     */
    async processFile(file, preview, dropZone) {
        const validation = Utils.validateFile(file);
        if (!validation.valid) {
            UI.showToast(validation.error, 'error');
            return null;
        }

        try {
            const base64 = await Utils.fileToBase64(file);

            preview.classList.remove('hidden');
            if (file.type.startsWith('image/')) {
                preview.innerHTML = `<img src="${base64}" alt="Preview de comprobante">`;
            } else {
                preview.innerHTML = `
                    <div class="pdf-preview">
                        <i class="bi bi-file-earmark-pdf"></i>
                        <span>${file.name}</span>
                    </div>
                `;
            }

            dropZone.innerHTML = `
                <i class="bi bi-check-circle text-success"></i>
                <p>Archivo listo</p>
                <span>Hacé clic para cambiar</span>
            `;

            return {
                file: base64,
                fileName: file.name,
                fileType: file.type,
                uploadedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error('Error processing receipt:', error);
            UI.showToast(CONSTANTS.MESSAGES.ERROR_GENERIC, 'error');
            return null;
        }
    },

    /**
     * Visualiza un comprobante - PDF en nueva pestaña, imágenes en modal con zoom
     */
    viewReceipt(receipt) {
        // Si es PDF, abrir en nueva pestaña directamente
        if (receipt.fileType === 'application/pdf') {
            this.openPDFInNewTab(receipt);
            return;
        }

        // Para imágenes, mostrar en modal con zoom
        this.viewImageInModal(receipt);
    },

    /**
     * Abre un PDF en una nueva pestaña del navegador
     */
    openPDFInNewTab(receipt) {
        try {
            // Convertir base64 a Blob
            const base64Data = receipt.file.split(',')[1];
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: 'application/pdf' });
            
            // Crear URL del blob
            const blobUrl = URL.createObjectURL(blob);
            
            // Abrir en nueva pestaña
            const newWindow = window.open(blobUrl, '_blank');
            
            if (newWindow) {
                // Limpiar el blob URL después de un tiempo
                setTimeout(() => {
                    URL.revokeObjectURL(blobUrl);
                }, 60000); // 1 minuto
            } else {
                // Si el navegador bloquea popups, crear un link y hacer click
                UI.showToast('Permitir ventanas emergentes para ver el PDF', 'warning');
                
                const link = document.createElement('a');
                link.href = blobUrl;
                link.target = '_blank';
                link.download = receipt.fileName || 'comprobante.pdf';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                setTimeout(() => {
                    URL.revokeObjectURL(blobUrl);
                }, 5000);
            }
        } catch (error) {
            console.error('Error abriendo PDF:', error);
            UI.showToast('Error al abrir el PDF', 'error');
        }
    },

    /**
     * Muestra una imagen en el modal con controles de zoom
     */
    viewImageInModal(receipt) {
        const modal = document.getElementById('view-receipt-modal');
        const content = modal.querySelector('.modal-body');
        const self = this;

        // Reset zoom
        this.currentZoom = 100;

        const expense = receipt.expenseId ? 
            Storage.getFixedExpenses().find(e => e.id === receipt.expenseId) : null;

        content.innerHTML = `
            <div class="receipt-viewer">
                <div class="receipt-viewer-header">
                    <h4>${expense ? expense.name : 'Comprobante'}</h4>
                    <span class="receipt-viewer-date">${Utils.formatDate(receipt.uploadedAt, 'time')}</span>
                </div>
                
                <div class="receipt-viewer-image">
                    <div class="zoom-controls">
                        <button type="button" class="zoom-btn" id="btn-zoom-out" title="Alejar">
                            <i class="bi bi-zoom-out"></i>
                        </button>
                        <span class="zoom-level" id="zoom-level-display">100%</span>
                        <button type="button" class="zoom-btn" id="btn-zoom-in" title="Acercar">
                            <i class="bi bi-zoom-in"></i>
                        </button>
                        <button type="button" class="zoom-btn" id="btn-zoom-reset" title="Restablecer">
                            <i class="bi bi-arrow-counterclockwise"></i>
                        </button>
                    </div>
                    <div class="image-container" id="image-container">
                        <img src="${receipt.file}" alt="Comprobante" class="receipt-full-image" id="receipt-image">
                    </div>
                </div>
                
                <div class="receipt-viewer-info">
                    <div class="info-row">
                        <span class="label"><i class="bi bi-file-earmark"></i> Archivo:</span>
                        <span class="value">${receipt.fileName || 'Sin nombre'}</span>
                    </div>
                    ${receipt.notes ? `
                        <div class="info-row">
                            <span class="label"><i class="bi bi-chat-left-text"></i> Notas:</span>
                            <span class="value">${receipt.notes}</span>
                        </div>
                    ` : ''}
                </div>

                <div class="receipt-viewer-actions">
                    <button type="button" class="action-btn action-btn-delete" id="btn-delete-receipt">
                        <i class="bi bi-trash"></i>
                        <span>Eliminar comprobante</span>
                    </button>
                </div>
            </div>
        `;

        // Abrir modal
        UI.openModal('view-receipt-modal');

        // Inicializar controles después de que el DOM esté listo
        setTimeout(() => {
            self.initImageZoom();

            // Botón eliminar con confirmación - usar onclick directo
            const deleteBtn = document.getElementById('btn-delete-receipt');
            if (deleteBtn) {
                deleteBtn.onclick = function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    self.handleDeleteFromViewer(receipt);
                };
            }
        }, 100);
    },

    async handleDeleteFromViewer(receipt) {
        // Cerrar el visor primero para que el modal de confirmación se vea bien
        UI.closeModal('view-receipt-modal');
        
        // Pequeño delay para que se cierre el visor antes de mostrar confirmación
        await Utils.delay(200);
        const confirm = await UI.showConfirm('¿Eliminar este comprobante?');
        if (confirm) {
            this.deleteReceiptInternal(receipt);
        }
    },

    /**
     * Inicializa el zoom para imágenes
     */
    initImageZoom() {
        const self = this;
        const image = document.getElementById('receipt-image');
        const zoomDisplay = document.getElementById('zoom-level-display');
        const container = document.getElementById('image-container');
        const zoomInBtn = document.getElementById('btn-zoom-in');
        const zoomOutBtn = document.getElementById('btn-zoom-out');
        const zoomResetBtn = document.getElementById('btn-zoom-reset');

        if (!image || !zoomDisplay) {
            console.error('Elementos de zoom no encontrados');
            return;
        }

        self.currentZoom = 100;

        // Zoom In
        if (zoomInBtn) {
            zoomInBtn.onclick = function(e) {
                e.preventDefault();
                self.currentZoom = Math.min(self.currentZoom + 25, 300);
                image.style.transform = `scale(${self.currentZoom / 100})`;
                zoomDisplay.textContent = self.currentZoom + '%';
            };
        }

        // Zoom Out
        if (zoomOutBtn) {
            zoomOutBtn.onclick = function(e) {
                e.preventDefault();
                self.currentZoom = Math.max(self.currentZoom - 25, 50);
                image.style.transform = `scale(${self.currentZoom / 100})`;
                zoomDisplay.textContent = self.currentZoom + '%';
            };
        }

        // Zoom Reset
        if (zoomResetBtn) {
            zoomResetBtn.onclick = function(e) {
                e.preventDefault();
                self.currentZoom = 100;
                image.style.transform = 'scale(1)';
                zoomDisplay.textContent = '100%';
                if (container) {
                    container.scrollTop = 0;
                    container.scrollLeft = 0;
                }
            };
        }
    },

    /**
     * Elimina un comprobante (uso interno)
     */
    deleteReceiptInternal(receipt) {
        if (receipt.id) {
            Storage.deleteReceipt(receipt.id);
        }

        if (receipt.expenseId) {
            Storage.updateFixedExpense(receipt.expenseId, {
                receipt: null
            });
        }

        UI.showToast('Comprobante eliminado', 'success');
        this.render();
        
        if (typeof FixedModule !== 'undefined') {
            FixedModule.render();
        }
    },

    /**
     * Renderiza la lista de comprobantes
     */
    render() {
        const container = document.getElementById('receipts-gallery');
        if (!container) return;

        // Filtrar solo comprobantes de pago del usuario
        // Los comprobantes válidos son los que:
        // 1. Tienen expenseId (asociados a un gasto fijo)
        // 2. Fueron subidos por el usuario como comprobante de pago (no facturas de servicio)
        // 3. Tienen el campo uploadedAt (indica que fue subido manualmente)
        const allReceipts = Storage.getReceipts();
        const receipts = allReceipts.filter(receipt => {
            // Debe tener expenseId
            if (!receipt.expenseId) return false;
            
            // Verificar que el gasto asociado esté pagado
            const expense = Storage.getFixedExpenses().find(e => e.id === receipt.expenseId);
            if (!expense) return false;
            
            // Solo mostrar si el gasto está pagado y el receipt coincide con el guardado
            if (expense.status !== CONSTANTS.EXPENSE_STATUS.PAID) return false;
            if (!expense.receipt || expense.receipt.id !== receipt.id) return false;
            
            return true;
        });

        if (receipts.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="bi bi-receipt-cutoff"></i>
                    <p>No hay comprobantes guardados</p>
                    <span>Los comprobantes aparecerán aquí cuando marques pagos como completados</span>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="list-header">
                <span>${receipts.length} comprobante${receipts.length !== 1 ? 's' : ''}</span>
            </div>
            <div class="items-list">
                ${receipts.map(receipt => this.renderReceiptItem(receipt)).join('')}
            </div>
        `;

        // Eventos de ver
        container.querySelectorAll('.btn-view').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const receipt = receipts.find(r => r.id === id);
                if (receipt) {
                    this.viewReceipt(receipt);
                }
            });
        });

        // Eventos de eliminar
        container.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const receipt = receipts.find(r => r.id === id);
                if (receipt) {
                    const confirm = await UI.showConfirm('¿Eliminar este comprobante?');
                    if (confirm) {
                        this.deleteReceiptInternal(receipt);
                    }
                }
            });
        });
    },

    /**
     * Renderiza un item de comprobante con icono de categoría del servicio
     */
    renderReceiptItem(receipt) {
        const isImage = receipt.fileType && receipt.fileType.startsWith('image/');
        const isPDF = receipt.fileType === 'application/pdf';
        const expense = receipt.expenseId ? 
            Storage.getFixedExpenses().find(e => e.id === receipt.expenseId) : null;

        // Obtener icono de la categoría del servicio asociado
        let categoryIcon = isPDF ? 'bi-file-earmark-pdf' : 'bi-file-earmark-image';
        let iconClass = isPDF ? 'pdf-icon' : 'image-icon';
        
        if (expense && expense.category) {
            const category = CONSTANTS.FIXED_CATEGORIES.find(c => c.id === expense.category);
            if (category) {
                categoryIcon = category.icon;
                iconClass = `category-${expense.category}`;
            }
        }

        return `
            <div class="list-item receipt-item" data-id="${receipt.id}">
                <div class="item-icon ${iconClass}">
                    <i class="bi ${categoryIcon}"></i>
                </div>
                <div class="item-content">
                    <div class="item-title">${expense ? expense.name : receipt.fileName || 'Comprobante'}</div>
                    <div class="item-subtitle">
                        <span class="file-type-tag">${isPDF ? 'PDF' : 'Imagen'}</span>
                        <span>${Utils.formatDate(receipt.uploadedAt, 'time')}</span>
                        ${receipt.notes ? `<span class="receipt-notes">${Utils.truncate(receipt.notes, 20)}</span>` : ''}
                    </div>
                </div>
                <div class="item-actions">
                    <button class="action-btn action-btn-view btn-view" data-id="${receipt.id}" title="Ver">
                        <i class="bi bi-eye"></i>
                        <span>Ver</span>
                    </button>
                    <button class="action-btn action-btn-delete btn-delete" data-id="${receipt.id}" title="Eliminar">
                        <i class="bi bi-trash"></i>
                        <span>Eliminar</span>
                    </button>
                </div>
            </div>
        `;
    }
};

// Exportar
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReceiptsModule;
}
