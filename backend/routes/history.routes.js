/**
 * ====================================
 * HISTORY.ROUTES.JS - Rutas de Archivo
 * ====================================
 */

const express = require('express');
const router = express.Router();
const historyController = require('../controllers/history.controller');

// CRUD de historial
router.post('/archive', historyController.archiveMonth);
router.get('/', historyController.getArchivesSummary);
router.get('/:id', historyController.getArchiveDetails);
router.delete('/:id', historyController.deleteArchive);
router.delete('/', historyController.deleteAllArchives);

module.exports = router;
