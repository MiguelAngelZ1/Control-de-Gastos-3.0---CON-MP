/**
 * ====================================
 * PAYMENT.CONTROLLER.JS - Integración con Pasarelas
 * ====================================
 */

/**
 * Crea una preferencia de pago (Mercado Pago / Otros)
 * NOTA: Esta es una implementación base para futuras integraciones.
 */
exports.createPreference = async (req, res) => {
    try {
        const { amount, description, external_reference } = req.body;

        if (!amount || !description) {
            return res.status(400).json({ 
                success: false, 
                error: 'Datos de pago insuficientes para generar la preferencia.' 
            });
        }

        // Simulación de respuesta de pasarela
        // En producción, aquí se usaría el SDK de Mercado Pago
        const mockPreference = {
            id: 'mock-' + Date.now(),
            init_point: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=mock',
            status: 'mock_created'
        };

        console.log(`💳 Generando preferencia de pago para: ${description} ($${amount})`);
        
        res.json({
            success: true,
            ...mockPreference
        });

    } catch (error) {
        console.error('❌ Error al crear preferencia de pago:', error);
        res.status(500).json({ 
            success: false, 
            error: 'No se pudo conectar con la pasarela de pagos. Intente nuevamente en unos minutos.' 
        });
    }
};
