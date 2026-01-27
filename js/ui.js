/**
 * ====================================
 * UI.JS - Interfaz de Usuario
 * Control de Gastos v1.0
 * ====================================
 * Gestiona todos los componentes de UI
 */

const UI = {
    // Estado de la UI
    state: {
        activeTab: 'dashboard',
        sidebarOpen: false,
        modals: []
    },

    /**
     * Inicializa la UI
     */
    init() {
        this.bindGlobalEvents();
        this.initTabs();
        this.initModals();
        this.initTooltips();
    },

    /**
     * Bindea eventos globales
     */
    bindGlobalEvents() {
        // Toggle sidebar en móvil (Header principal y Header móvil)
        const menuToggle = document.getElementById('menu-toggle');
        const mobileToggle = document.getElementById('mobile-menu-toggle');
        const overlay = document.getElementById('sidebar-overlay');

        if (menuToggle) menuToggle.addEventListener('click', () => this.toggleSidebar());
        if (mobileToggle) mobileToggle.addEventListener('click', () => this.toggleSidebar());
        if (overlay) overlay.addEventListener('click', () => this.closeSidebar());

        // Cerrar sidebar al hacer click fuera
        document.addEventListener('click', (e) => {
            if (this.state.sidebarOpen && !e.target.closest('.sidebar') && !e.target.closest('#menu-toggle')) {
                this.closeSidebar();
            }
        });

        // Cerrar modal con Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.state.modals.length > 0) {
                this.closeTopModal();
            }
        });

        // Resize handler
        window.addEventListener('resize', Utils.debounce(() => {
            if (window.innerWidth >= 768) {
                this.closeSidebar();
            }
        }, 250));
    },

    /**
     * Inicializa las pestañas de navegación
     */
    initTabs() {
        const tabs = document.querySelectorAll('[data-tab]');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const tabId = tab.dataset.tab;
                this.showTab(tabId);
            });
        });
    },

    /**
     * Muestra una pestaña específica
     * @param {string} tabId - ID de la pestaña
     */
    showTab(tabId) {
        // Actualizar estado
        this.state.activeTab = tabId;

        // Limpiar tooltips residuales al cambiar de tab
        document.querySelectorAll('.tooltip').forEach(t => t.remove());

        // Actualizar navegación
        document.querySelectorAll('[data-tab]').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabId);
        });

        // Mostrar/ocultar contenido
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tabId}`);
        });

        // Cerrar sidebar en móvil
        this.closeSidebar();

        // Actualizar título
        this.updatePageTitle(tabId);
    },

    /**
     * Actualiza el título de la página
     * @param {string} tabId - ID de la pestaña
     */
    updatePageTitle(tabId) {
        const titles = {
            dashboard: 'Dashboard',
            incomes: 'Ingresos',
            weekly: 'Gastos Semanales',
            fixed: 'Gastos Fijos',
            receipts: 'Comprobantes'
        };
        const pageTitle = document.getElementById('page-title');
        if (pageTitle) {
            pageTitle.textContent = titles[tabId] || 'Control de Gastos';
        }
    },

    /**
     * Toggle sidebar
     */
    toggleSidebar() {
        this.state.sidebarOpen ? this.closeSidebar() : this.openSidebar();
    },

    /**
     * Abre el sidebar
     */
    openSidebar() {
        this.state.sidebarOpen = true;
        document.getElementById('sidebar')?.classList.add('active');
        document.getElementById('sidebar-overlay')?.classList.add('active');
        document.body.classList.add('sidebar-open');
    },

    /**
     * Cierra el sidebar
     */
    closeSidebar() {
        this.state.sidebarOpen = false;
        document.getElementById('sidebar')?.classList.remove('active');
        document.getElementById('sidebar-overlay')?.classList.remove('active');
        document.body.classList.remove('sidebar-open');
    },

    /**
     * Inicializa los modales
     */
    initModals() {
        // Crear contenedor de modales si no existe
        if (!document.getElementById('modals-container')) {
            const container = document.createElement('div');
            container.id = 'modals-container';
            document.body.appendChild(container);
        }

        // Cerrar modal al hacer click en el overlay
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.closeTopModal();
                }
            });
        });

        // Botones de cerrar modal
        document.querySelectorAll('[data-close-modal]').forEach(btn => {
            btn.addEventListener('click', () => {
                const modalId = btn.dataset.closeModal;
                this.closeModal(modalId);
            });
        });
    },

    /**
     * Abre un modal
     * @param {string} modalId - ID del modal
     */
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        modal.classList.add('open');
        document.body.classList.add('modal-open');
        this.state.modals.push(modalId);

        // Focus en el primer input
        setTimeout(() => {
            const firstInput = modal.querySelector('input:not([type="hidden"]), textarea, select');
            if (firstInput) {
                firstInput.focus();
            }
        }, 100);
    },

    /**
     * Cierra un modal específico
     * @param {string} modalId - ID del modal
     */
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        modal.classList.remove('open');
        this.state.modals = this.state.modals.filter(id => id !== modalId);

        if (this.state.modals.length === 0) {
            document.body.classList.remove('modal-open');
        }
    },

    /**
     * Cierra el modal superior
     */
    closeTopModal() {
        if (this.state.modals.length > 0) {
            const topModalId = this.state.modals[this.state.modals.length - 1];
            this.closeModal(topModalId);
        }
    },

    /**
     * Muestra un toast/notificación
     * @param {string} message - Mensaje a mostrar
     * @param {string} type - Tipo: success, error, warning, info
     * @param {number} duration - Duración en ms
     */
    showToast(message, type = 'info', duration = 3000) {
        // Crear contenedor si no existe
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }

        // Crear toast
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icons = {
            success: 'bi-check-circle',
            error: 'bi-x-circle',
            warning: 'bi-exclamation-triangle',
            info: 'bi-info-circle'
        };

        toast.innerHTML = `
            <i class="bi ${icons[type]}"></i>
            <span>${message}</span>
            <button class="toast-close"><i class="bi bi-x"></i></button>
        `;

        container.appendChild(toast);

        // Animación de entrada
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Cerrar al hacer click
        toast.querySelector('.toast-close').addEventListener('click', () => {
            this.removeToast(toast);
        });

        // Auto-cerrar
        if (duration > 0) {
            setTimeout(() => {
                this.removeToast(toast);
            }, duration);
        }
    },

    /**
     * Remueve un toast
     * @param {HTMLElement} toast - Elemento toast
     */
    removeToast(toast) {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    },

    /**
     * Muestra un diálogo de confirmación
     * @param {string} message - Mensaje de confirmación
     * @param {Function} onConfirm - Callback al confirmar
     * @param {Function} onCancel - Callback al cancelar
     */
    showConfirm(message, onConfirm, onCancel = () => {}) {
        const modal = document.getElementById('confirm-modal');
        if (!modal) return;

        const messageEl = modal.querySelector('.confirm-message');
        const confirmBtn = modal.querySelector('#confirm-yes');
        const cancelBtn = modal.querySelector('#confirm-no');

        messageEl.textContent = message;

        // Limpiar eventos anteriores
        const newConfirmBtn = confirmBtn.cloneNode(true);
        const newCancelBtn = cancelBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

        // Nuevos eventos
        newConfirmBtn.addEventListener('click', () => {
            this.closeModal('confirm-modal');
            onConfirm();
        });

        newCancelBtn.addEventListener('click', () => {
            this.closeModal('confirm-modal');
            onCancel();
        });

        this.openModal('confirm-modal');
    },

    /**
     * Abre el modal de subida de comprobante
     * @param {string} expenseId - ID del gasto
     * @param {Function} callback - Callback con datos del comprobante
     */
    openReceiptUploadModal(expenseId, callback) {
        ReceiptsModule.openUploadModal(expenseId, callback);
    },

    /**
     * Inicializa tooltips
     */
    initTooltips() {
        // Simple tooltip implementation
        document.querySelectorAll('[title]').forEach(el => {
            el.addEventListener('mouseenter', (e) => {
                const title = e.target.getAttribute('title');
                if (!title) return;

                e.target.setAttribute('data-title', title);
                e.target.removeAttribute('title');

                const tooltip = document.createElement('div');
                tooltip.className = 'tooltip';
                tooltip.textContent = title;
                document.body.appendChild(tooltip);

                const rect = e.target.getBoundingClientRect();
                tooltip.style.top = `${rect.top - tooltip.offsetHeight - 5}px`;
                tooltip.style.left = `${rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2)}px`;
                
                requestAnimationFrame(() => tooltip.classList.add('show'));
            });

            el.addEventListener('mouseleave', (e) => {
                const title = e.target.getAttribute('data-title');
                if (title) {
                    e.target.setAttribute('title', title);
                    e.target.removeAttribute('data-title');
                }
                document.querySelectorAll('.tooltip').forEach(t => t.remove());
            });
        });
    },

    /**
     * Muestra un loader
     * @param {string} message - Mensaje del loader
     */
    showLoader(message = 'Cargando...') {
        let loader = document.getElementById('global-loader');
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'global-loader';
            loader.className = 'global-loader';
            document.body.appendChild(loader);
        }

        loader.innerHTML = `
            <div class="loader-content">
                <div class="loading-spinner"></div>
                <span>${message}</span>
            </div>
        `;
        loader.classList.add('show');
    },

    /**
     * Oculta el loader
     */
    hideLoader() {
        const loader = document.getElementById('global-loader');
        if (loader) {
            loader.classList.remove('show');
        }
    },

    /**
     * Anima un número
     * @param {HTMLElement} element - Elemento a animar
     * @param {number} start - Valor inicial
     * @param {number} end - Valor final
     * @param {number} duration - Duración en ms
     * @param {Function} formatter - Función de formateo
     */
    animateNumber(element, start, end, duration = 500, formatter = Utils.formatCurrency) {
        const startTime = performance.now();
        const diff = end - start;

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing
            const easeOutQuad = progress * (2 - progress);
            const current = start + diff * easeOutQuad;
            
            element.textContent = formatter(current);

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }
};

// Exportar
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UI;
}
