const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const budgetService = require('../services/BudgetService');

console.log('✅ budgetController.js loaded');
const router = express.Router();

// Configurar multer para subida de archivos Excel
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const isVercel = process.env.VERCEL || process.env.NOW_BUILDER || process.env.NODE_ENV === 'production';
    const uploadsDir = isVercel ? '/tmp' : path.join(__dirname, '..', '..', 'uploads');
    
    if (!isVercel && !fs.existsSync(uploadsDir)) {
      try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch (e) {}
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${file.originalname}`);
  },
});
const upload = multer({ storage });

// ==========================================
// CARGA Y DATOS
// ==========================================

/** POST /api/budget/upload — Sube Excel y carga presupuesto en Supabase */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo.' });
    const sheetName = req.body.sheetName || 'Detalle';
    const result = await budgetService.loadBudget(req.file.path, sheetName);
    res.json({ message: `Presupuesto cargado exitosamente en Supabase: ${result.totalLines} líneas.`, ...result });
  } catch (error) {
    console.error('Error al cargar presupuesto:', error);
    res.status(500).json({ error: error.message });
  }
});

/** POST /api/budget/load-default — Carga el Excel por defecto */
router.post('/load-default', async (req, res) => {
  try {
    const defaultPath = (req.body && req.body.filePath) ? req.body.filePath : path.join(
      __dirname, '..', '..', 'Presupuesto general A-MAQ 2026 Rev 13-01-25 - 7300.xlsx'
    );
    const sheetName = (req.body && req.body.sheetName) ? req.body.sheetName : 'Detalle';

    if (!fs.existsSync(defaultPath)) {
      console.warn(`⚠️ Archivo por defecto no encontrado en: ${defaultPath}. Omitiendo carga inicial.`);
      return res.json({
        message: 'Archivo base no encontrado. Se utilizarán los datos existentes en Supabase.',
        totalLines: 0,
        skipped: true
      });
    }

    const result = await budgetService.loadBudget(defaultPath, sheetName);
    res.json({ message: `Presupuesto base cargado: ${result.totalLines} líneas.`, ...result });
  } catch (error) {
    console.error('Error al cargar presupuesto por defecto:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// KPIs E INDICADORES
// ==========================================

/** GET /api/budget/kpis — KPIs globales con filtros */
router.get('/kpis', async (req, res) => {
  try {
    const kpis = await budgetService.getKPIs(req.query);
    res.json(kpis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** GET /api/budget/monthly — Datos mensuales para gráficos */
router.get('/monthly', async (req, res) => {
  try {
    const data = await budgetService.getMonthlyData(req.query);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** GET /api/budget/weekly-flow — Flujo semanal estimado */
router.get('/weekly-flow', async (req, res) => {
  try {
    const data = await budgetService.getWeeklyFlow(req.query);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** POST /api/budget/unpaid-invoices — Facturas pendientes de pago de Dolibarr */
router.post('/unpaid-invoices', async (req, res) => {
  try {
    const { endWeek, dolibarrConfig } = req.body;
    const data = await budgetService.getUnpaidInvoices(endWeek, dolibarrConfig);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** GET /api/budget/filters — Opciones de filtros disponibles */
router.get('/filters', async (req, res) => {
  try {
    const options = await budgetService.getFilterOptions();
    res.json(options);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** GET /api/budget/unassigned-docs — Documentos sin asignación de línea de presupuesto */
router.get('/unassigned-docs', async (req, res) => {
  try {
    // Leer la configuración de Dolibarr desde el body del GET o de env
    const dolibarrConfig = req.query.dolibarrConfig
      ? JSON.parse(req.query.dolibarrConfig)
      : null;
    const result = await budgetService.getUnassignedDocuments(dolibarrConfig);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// CRUD DE LÍNEAS
// ==========================================

/** GET /api/budget — Lista líneas; ?includeDeleted=true para incluir eliminadas */
router.get('/', async (req, res) => {
  try {
    const lines = await budgetService.getBudgetLines(req.query);
    res.json(lines);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** GET /api/budget/export-weekly — Descarga flujo de caja 52 semanas */
router.get('/export-weekly', async (req, res) => {
  try {
    const { startWeek, endWeek, simplified, ...filters } = req.query;
    const options = {
      startWeek: parseInt(startWeek) || 1,
      endWeek: parseInt(endWeek) || 52,
      simplified: simplified !== 'false'
    };
    const buffer = await budgetService.exportWeeklyExcel(filters, options);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=FlujoSemanal.xlsx');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** POST /api/budget/export-weekly-custom — Descarga flujo con modificaciones custom (facturas unificadas) */
router.post('/export-weekly-custom', async (req, res) => {
  try {
    const { customData, options } = req.body;
    // customData ya viene pre-procesado del frontend con las filas exactas
    const { generateCustomWeeklyCashFlowExcel } = require('../repositories/excelRepository');
    const buffer = generateCustomWeeklyCashFlowExcel(customData, options);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=FlujoSemanal_Refinado.xlsx');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** GET /api/budget/:id/movements — Obtiene todos los movimientos (ejecución) de una línea */
router.get('/:id/movements', async (req, res) => {
  try {
    const movements = await budgetService.getLineMovements(req.params.id);
    res.json(movements);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** GET /api/budget/:id — Obtiene una línea por ID */
router.get('/:id', async (req, res) => {
  try {
    const line = await budgetService.getBudgetLineById(req.params.id);
    if (!line) return res.status(404).json({ error: 'Línea no encontrada.' });
    res.json(line);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** POST /api/budget — Crea una nueva línea */
router.post('/', async (req, res) => {
  try {
    const line = await budgetService.createLine(req.body);
    res.status(201).json(line);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** PUT /api/budget/:id — Actualiza una línea existente */
router.put('/:id', async (req, res) => {
  try {
    const line = await budgetService.updateLine(req.params.id, req.body);
    res.json(line);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** PUT /api/budget/:id/restore — Restaura una línea eliminada */
router.put('/:id/restore', async (req, res) => {
  try {
    const result = await budgetService.restoreLine(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/** DELETE /api/budget/:id — Eliminación lógica (estado='eliminada') */
router.delete('/:id', async (req, res) => {
  try {
    const physical = req.query.physical === 'true';
    const reason = req.body.reason || 'No especificado';
    const result = await budgetService.deleteLine(req.params.id, reason, physical);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// TRASLADOS DE PRESUPUESTO
// ==========================================

/** GET /api/budget/transfers — Lista todos los traslados */
router.get('/transfers/list', async (req, res) => {
  try {
    const transfers = await budgetService.listTransfers();
    res.json(transfers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** POST /api/budget/transfers — Solicita un nuevo traslado (pendiente) */
router.post('/transfers', async (req, res) => {
  try {
    const { fromId, toId, amounts, motivo, solicitante } = req.body;
    if (!fromId || !toId || !amounts) {
      return res.status(400).json({ error: 'Se requieren fromId, toId y amounts.' });
    }
    if (!motivo || !motivo.trim()) {
      return res.status(400).json({ error: 'El motivo es obligatorio.' });
    }
    if (!solicitante || !solicitante.trim()) {
      return res.status(400).json({ error: 'El nombre del solicitante es obligatorio.' });
    }
    const transfer = await budgetService.createTransfer(fromId, toId, amounts, motivo, solicitante);
    res.status(201).json(transfer);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/** POST /api/budget/transfers/:id/approve — Aprueba un traslado pendiente */
router.post('/transfers/:id/approve', async (req, res) => {
  try {
    const result = await budgetService.approveTransfer(req.params.id, req.body.approvedBy);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/** POST /api/budget/transfers/:id/reject — Rechaza un traslado pendiente */
router.post('/transfers/:id/reject', async (req, res) => {
  try {
    const result = await budgetService.rejectTransfer(req.params.id, req.body.reason);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/** DELETE /api/budget/transfers/:id — Elimina un traslado en estado pendiente o rechazado */
router.delete('/transfers/:id', async (req, res) => {
  try {
    const result = await budgetService.deleteTransfer(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/** PUT /api/budget/transfers/:id — Modifica un traslado en estado pendiente */
router.put('/transfers/:id', async (req, res) => {
  try {
    const { fromId, toId, amounts, motivo, solicitante } = req.body;
    const result = await budgetService.updateTransfer(req.params.id, { fromId, toId, amounts, motivo, solicitante });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ==========================================
// GUARDAR Y SINCRONIZAR
// ==========================================

/** POST /api/budget/save-excel — Guarda datos en Excel */
router.post('/save-excel', async (req, res) => {
  try {
    const defaultPath = req.body.filePath || path.join(__dirname, '..', '..', 'Presupuesto general A-MAQ 2026 Rev 13-01-25 - 7300.xlsx');
    const result = await budgetService.saveToExcel(defaultPath, req.body.sheetName || 'Detalle');
    res.json({ message: `Archivo exportado/guardado satisfactoriamente. Backup en: ${result.backupPath}`, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** POST /api/budget/sync-dolibarr — Sincroniza movimientos desde Dolibarr */
router.post('/sync-dolibarr', async (req, res) => {
  try {
    const dolibarrConfig = req.body.dolibarrConfig || null;
    const result = await budgetService.syncDolibarr(dolibarrConfig);
    res.json({ message: 'Sincronización completada.', ...result });
  } catch (error) {
    console.error('Error en sync-dolibarr:', error);
    res.status(500).json({ error: error.message });
  }
});

/** GET /api/budget/config/sync-log — Historial de sincronizaciones */
router.get('/config/sync-log', async (req, res) => {
  try {
    res.json(await budgetService.getSyncLog());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
