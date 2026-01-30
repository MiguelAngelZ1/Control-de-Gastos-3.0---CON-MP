/**
 * ====================================
 * API.JS - Servicio de Comunicación
 * ====================================
 * Centraliza todas las llamadas al backend con manejo
 * de errores genérico para mayor seguridad y limpieza.
 */

const API = {
    /**
     * Helper genérico para peticiones fetch
     */
    async request(url, options = {}) {
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                // Mensaje genérico para el usuario si el backend no envía uno amigable
                throw new Error(data.error || 'No pudimos completar la operación. Por favor, intenta de nuevo.');
            }

            return data;
        } catch (error) {
            console.error(`🔴 API Error [${url}]:`, error);
            throw error; // Re-lanzar para que el módulo lo maneje si necesita
        }
    },

    // --- MÓDULO: ARCHIVO / HISTORIAL ---
    
    async archiveMonth(payload) {
        return this.request('/api/history/archive', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },

    async getHistory() {
        return this.request('/api/history');
    },

    async getHistoryDetail(id) {
        return this.request(`/api/history/${id}`);
    },

    async deleteHistoryItem(id) {
        return this.request(`/api/history/${id}`, { method: 'DELETE' });
    },

    async clearAllHistory() {
        return this.request('/api/history', { method: 'DELETE' });
    },

    // --- MÓDULO: FACTURAS / OCR ---

    async uploadInvoice(formData) {
        // Para FormData no enviamos Content-Type manual, fetch lo hace solo
        try {
            const response = await fetch('/api/invoice/upload', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Error al procesar el comprobante.');
            }
            return data;
        } catch (error) {
            console.error('🔴 API Upload Error:', error);
            throw error;
        }
    },

    // --- MÓDULO: PAGOS ---

    async createPaymentPreference(paymentData) {
        return this.request('/api/payments/create-preference', {
            method: 'POST',
            body: JSON.stringify(paymentData)
        });
    }
};

window.API = API;
