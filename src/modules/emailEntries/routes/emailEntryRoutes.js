import { Router } from 'express';
import { authenticate, authorize } from '../../../middleware/auth.js';
import {
  validateCreateEmailEntry,
  validateMapEmailEntry,
  validateUpdateEmailEntry,
} from '../validators/emailEntryValidators.js';
import {
  createEmailEntry,
  getEmailEntryById,
  listEmailEntries,
  updateEmailEntry,
  deleteEmailEntry,
  mapEmailEntry,
  generateNarrative,
  createActivityFromEmail,
  createTimeEntryFromEmail,
  syncEmailEntryToZoho,
  bulkIngest,
  getEmailEntryMetrics,
  reconcileEmailEntries,
  repairEmailEntry,
} from '../controllers/emailEntryController.js';

const router = Router();

router.use(authenticate);

// Core ingest & listing
router.post('/', validateCreateEmailEntry, createEmailEntry);
router.get('/', listEmailEntries);

// Optional: batch ingest from the Chrome extension
router.post('/bulk', bulkIngest);

// Operations
router.get('/ops/metrics', authorize('admin', 'partner'), getEmailEntryMetrics);
router.get('/ops/reconcile', authorize('admin', 'partner'), reconcileEmailEntries);
router.post('/ops/reconcile/:id/repair', authorize('admin', 'partner'), repairEmailEntry);

router.get('/:id', getEmailEntryById);

// Maintenance
router.patch('/:id', validateUpdateEmailEntry, updateEmailEntry);
router.delete('/:id', deleteEmailEntry);

// Mapping + GPT + derivatives
router.post('/:id/map', validateMapEmailEntry, mapEmailEntry);
router.post('/:id/gpt-narrative', generateNarrative);
router.post('/:id/activity', createActivityFromEmail);
router.post('/:id/time-entry', createTimeEntryFromEmail);

// Integrations
router.post('/:id/sync-zoho', syncEmailEntryToZoho);

export default router;
