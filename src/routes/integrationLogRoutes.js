// src/routes/integrationLogRoutes.js
import { Router } from 'express';
import {
  createIntegrationLog,
  listIntegrationLogs,
  getIntegrationLogById,
  listLogsByBillable,
  listLogsByInvoice,
  logStats,
  deleteIntegrationLog,
  purgeIntegrationLogs,
} from '../controllers/integrationLogController.js';

const router = Router();

// Create (useful for diagnostics/tests)
router.post('/integration-logs', createIntegrationLog);

// Read/list (filters via query string)
router.get('/integration-logs', listIntegrationLogs);
router.get('/integration-logs/:id', getIntegrationLogById);

// Convenience: by entity
router.get('/integration-logs/by-billable/:billableId', listLogsByBillable);
router.get('/integration-logs/by-invoice/:invoiceId', listLogsByInvoice);

// Aggregate stats
router.get('/integration-logs/stats', logStats);

// Delete (single) and purge (bulk-by-filter)
router.delete('/integration-logs/:id', deleteIntegrationLog);
router.delete('/integration-logs', purgeIntegrationLogs);

export default router;
