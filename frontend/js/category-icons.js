/**
 * ====================================
 * CATEGORY-ICONS.JS - Iconos Dinámicos de Categorías
 * Control de Gastos v1.0
 * ====================================
 * Maneja el cambio dinámico de iconos en los selects de categoría
 */

const CategoryIcons = {
    /**
     * Inicializa los selects de categoría con iconos dinámicos
     */
    init() {
        // Select de gastos fijos
        const fixedSelect = document.getElementById('fixed-category');
        const fixedIcon = document.getElementById('fixed-category-icon');
        
        if (fixedSelect && fixedIcon) {
            // Establecer icono inicial
            this.updateIcon(fixedSelect.value, fixedIcon, CONSTANTS.FIXED_CATEGORIES);
            
            // Listener para cambios
            fixedSelect.addEventListener('change', (e) => {
                this.updateIcon(e.target.value, fixedIcon, CONSTANTS.FIXED_CATEGORIES);
            });
        }
        
        // Select de gastos semanales
        const weeklySelect = document.getElementById('weekly-category');
        const weeklyIcon = document.getElementById('weekly-category-icon');
        
        if (weeklySelect && weeklyIcon) {
            // Establecer icono inicial
            this.updateIcon(weeklySelect.value, weeklyIcon, CONSTANTS.VARIABLE_CATEGORIES);
            
            // Listener para cambios
            weeklySelect.addEventListener('change', (e) => {
                this.updateIcon(e.target.value, weeklyIcon, CONSTANTS.VARIABLE_CATEGORIES);
            });
        }
    },
    
    /**
     * Actualiza el icono del select según la categoría seleccionada
     * @param {string} categoryId - ID de la categoría
     * @param {HTMLElement} iconElement - Elemento del icono
     * @param {Array} categories - Array de categorías (FIXED o VARIABLE)
     */
    updateIcon(categoryId, iconElement, categories) {
        const category = categories.find(c => c.id === categoryId);
        
        if (category && iconElement) {
            // Remover todas las clases de icono anteriores
            iconElement.className = '';
            
            // Agregar nuevas clases
            iconElement.className = `bi ${category.icon} select-icon`;
        }
    }
};

// Auto-inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => CategoryIcons.init());
} else {
    CategoryIcons.init();
}

// Exportar para uso modular
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CategoryIcons;
}
