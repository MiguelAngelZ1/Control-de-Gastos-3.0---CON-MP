/**
 * ====================================
 * PAYMENT.ROUTES.JS - Rutas de Pago
 * ====================================
 */

const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');

// Integración Mercado Pago / Pasarelas
router.post('/create-preference', paymentController.createPreference);

module.exports = router;
