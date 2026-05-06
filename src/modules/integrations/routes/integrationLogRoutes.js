import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import {
  validateCreateIntegrationLog,
  validatePurgeIntegrationLogs,
} from '../validators/integrationLogValidators.js';
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

router.use(authenticate);

// Create (useful for diagnostics/tests)
router.post('/', validateCreateIntegrationLog, createIntegrationLog);

// Read/list (filters via query string)
router.get('/', listIntegrationLogs);

// Convenience: by entity
router.get('/by-billable/:billableId', listLogsByBillable);
router.get('/by-invoice/:invoiceId', listLogsByInvoice);

// Aggregate stats
router.get('/stats', logStats);
router.get('/:id', getIntegrationLogById);

// Delete (single) and purge (bulk-by-filter)
router.delete('/:id', deleteIntegrationLog);
router.delete('/', validatePurgeIntegrationLogs, purgeIntegrationLogs);

export default router;
