/**
 * ====================================
 * INVOICE.ROUTES.JS - Rutas de Facturas
 * ====================================
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const invoiceController = require('../controllers/invoice.controller');

// Configuración de Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `invoice-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
        cb(null, allowed.includes(file.mimetype));
    }
});

// Ruta principal de subida
router.post('/upload', upload.single('invoice'), invoiceController.uploadAndProcess);

module.exports = router;
