/**
 * ====================================
 * PAYMENTS.JS - Módulo de Pagos
 * Control de Gastos v1.0
 * ====================================
 * Gestiona la integración con sistemas de pago externos
 * Preparado para Mercado Pago API
 */

const PaymentsModule = {
    /**
     * Inicializa el módulo
     */
    init() {
        // Verificar si venimos de una redirección de pago
        this.checkPaymentReturn();
    },

    /**
     * Verifica si el usuario vuelve de un pago externo
     */
    checkPaymentReturn() {
        const urlParams = new URLSearchParams(window.location.search);
        const paymentStatus = urlParams.get('payment_status');
        const expenseId = urlParams.get('expense_id');

        if (paymentStatus && expenseId) {
            this.handlePaymentReturn(expenseId, paymentStatus);
            
            // Limpiar URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    },

    /**
     * Maneja el retorno de un pago externo
     * @param {string} expenseId - ID del gasto
     * @param {string} status - Estado del pago
     */
    handlePaymentReturn(expenseId, status) {
        const expense = Storage.getFixedExpenses().find(e => e.id === expenseId);
        
        if (!expense) {
            console.warn('Expense not found for payment return:', expenseId);
            return;
        }

        if (status === 'success' || status === 'approved') {
            // Mostrar modal para confirmar y adjuntar comprobante
            setTimeout(() => {
                UI.showToast('¡Pago realizado! Confirmá y adjuntá el comprobante.', 'success');
                FixedModule.markAsPaid(expenseId);
            }, 500);
        } else if (status === 'pending') {
            Storage.updateFixedExpense(expenseId, {
                status: CONSTANTS.EXPENSE_STATUS.PROCESSING
            });
            UI.showToast('El pago está pendiente de confirmación', 'info');
            FixedModule.render();
        } else {
            Storage.updateFixedExpense(expenseId, {
                status: CONSTANTS.EXPENSE_STATUS.ERROR
            });
            UI.showToast('Hubo un problema con el pago. Por favor, intentá de nuevo.', 'error');
            FixedModule.render();
        }
    },

    /**
     * Redirige a Mercado Pago para realizar el pago
     * @param {object} expense - Datos del gasto
     */
    redirectToMercadoPago(expense) {
        if (!expense.invoiceData) {
            UI.showToast('No hay datos de factura para este pago', 'error');
            return;
        }

        // Mostrar mensaje de redirección
        UI.showToast(CONSTANTS.MESSAGES.PAYMENT_REDIRECT, 'info');

        // Preparar datos para Mercado Pago
        const paymentData = {
            amount: expense.invoiceData.amount,
            reference: expense.invoiceData.reference || expense.invoiceData.barcode,
            description: `Pago de ${expense.name}`,
            expenseId: expense.id
        };

        // En producción, aquí se generaría una preferencia de pago
        // usando la API de Mercado Pago del backend

        if (CONSTANTS.MERCADO_PAGO.SANDBOX_MODE) {
            // Modo sandbox: simular redirección
            this.simulatePaymentRedirect(expense, paymentData);
        } else {
            // Modo producción: redirección real a MP
            this.createMercadoPagoPreference(paymentData)
                .then(preference => {
                    window.location.href = preference.init_point;
                })
                .catch(error => {
                    console.error('Error creating MP preference:', error);
                    UI.showToast('Error al conectar con Mercado Pago', 'error');
                    Storage.updateFixedExpense(expense.id, {
                        status: CONSTANTS.EXPENSE_STATUS.INVOICE_LOADED
                    });
                    FixedModule.render();
                });
        }
    },

    /**
     * Simula una redirección a Mercado Pago (para desarrollo)
     * @param {object} expense - Datos del gasto
     * @param {object} paymentData - Datos de pago
     */
    simulatePaymentRedirect(expense, paymentData) {
        const modal = document.getElementById('payment-simulation-modal');
        const content = modal.querySelector('.modal-body');

        content.innerHTML = `
            <div class="payment-simulation">
                <div class="mp-header">
                    <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgNjAiPjxyZWN0IGZpbGw9IiMwMDliZWUiIHdpZHRoPSIyMDAiIGhlaWdodD0iNjAiIHJ4PSI4Ii8+PHRleHQgeD0iNTAlIiB5PSI1NSUiIGZpbGw9IndoaXRlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTgiIGZvbnQtd2VpZ2h0PSJib2xkIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5NZXJjYWRvIFBhZ288L3RleHQ+PC9zdmc+" alt="Mercado Pago" class="mp-logo">
                    <span class="sandbox-badge">MODO SIMULACIÓN</span>
                </div>

                <div class="payment-details">
                    <h4>Detalle del pago</h4>
                    <div class="detail-row">
                        <span>Concepto:</span>
                        <strong>${expense.name}</strong>
                    </div>
                    <div class="detail-row">
                        <span>Referencia:</span>
                        <code>${paymentData.reference}</code>
                    </div>
                    <div class="detail-row amount-row">
                        <span>Monto a pagar:</span>
                        <strong class="amount">${Utils.formatCurrency(paymentData.amount)}</strong>
                    </div>
                </div>

                <div class="simulation-note">
                    <i class="bi bi-info-circle"></i>
                    <p>Esta es una simulación. En producción, serías redirigido a Mercado Pago para completar el pago real.</p>
                </div>

                <div class="simulation-actions">
                    <button type="button" class="btn btn-success btn-lg" id="sim-success-btn">
                        <i class="bi bi-check-circle"></i> Simular pago exitoso
                    </button>
                    <button type="button" class="btn btn-warning" id="sim-pending-btn">
                        <i class="bi bi-clock"></i> Simular pago pendiente
                    </button>
                    <button type="button" class="btn btn-danger" id="sim-error-btn">
                        <i class="bi bi-x-circle"></i> Simular error
                    </button>
                    <button type="button" class="btn btn-secondary" id="sim-cancel-btn">
                        Cancelar
                    </button>
                </div>
            </div>
        `;

        // Eventos de simulación
        document.getElementById('sim-success-btn').addEventListener('click', () => {
            UI.closeModal('payment-simulation-modal');
            this.handlePaymentReturn(expense.id, 'success');
        });

        document.getElementById('sim-pending-btn').addEventListener('click', () => {
            UI.closeModal('payment-simulation-modal');
            this.handlePaymentReturn(expense.id, 'pending');
        });

        document.getElementById('sim-error-btn').addEventListener('click', () => {
            UI.closeModal('payment-simulation-modal');
            this.handlePaymentReturn(expense.id, 'error');
        });

        document.getElementById('sim-cancel-btn').addEventListener('click', () => {
            UI.closeModal('payment-simulation-modal');
            Storage.updateFixedExpense(expense.id, {
                status: CONSTANTS.EXPENSE_STATUS.INVOICE_LOADED
            });
            FixedModule.render();
        });

        UI.openModal('payment-simulation-modal');
    },

    /**
     * Crea una preferencia de pago en Mercado Pago
     * NOTA: En producción, esto debería llamar a un endpoint del backend
     * @param {object} paymentData - Datos de pago
     * @returns {Promise<object>} Preferencia de pago
     */
    async createMercadoPagoPreference(paymentData) {
        // Esta función está preparada para integración con backend real
        // El backend debería:
        // 1. Recibir los datos de pago
        // 2. Crear una preferencia en Mercado Pago usando el SDK
        // 3. Retornar el init_point para redirección

        const response = await fetch('/api/payments/create-preference', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount: paymentData.amount,
                description: paymentData.description,
                external_reference: paymentData.reference,
                back_urls: {
                    success: `${window.location.origin}?payment_status=success&expense_id=${paymentData.expenseId}`,
                    pending: `${window.location.origin}?payment_status=pending&expense_id=${paymentData.expenseId}`,
                    failure: `${window.location.origin}?payment_status=error&expense_id=${paymentData.expenseId}`
                }
            })
        });

        if (!response.ok) {
            throw new Error('Failed to create payment preference');
        }

        return response.json();
    },

    /**
     * Genera un link de pago con código de barras
     * NOTA: Funcionalidad preparada para pagos de servicios
     * @param {string} barcode - Código de barras
     * @returns {string} URL de pago
     */
    generateBarcodePaymentLink(barcode) {
        // Mercado Pago permite pagar servicios escaneando códigos de barras
        // Esta URL redirigiría a la app de MP con el código precargado
        return `https://www.mercadopago.com.ar/services/pay?barcode=${encodeURIComponent(barcode)}`;
    },

    /**
     * Obtiene el historial de pagos
     * @returns {Array} Lista de pagos
     */
    getPaymentHistory() {
        const fixedExpenses = Storage.getFixedExpenses();
        return fixedExpenses
            .filter(e => e.status === CONSTANTS.EXPENSE_STATUS.PAID)
            .map(e => ({
                id: e.id,
                name: e.name,
                amount: e.amount,
                paidAt: e.paidAt,
                receipt: e.receipt
            }))
            .sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));
    }
};

// Exportar
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PaymentsModule;
}
