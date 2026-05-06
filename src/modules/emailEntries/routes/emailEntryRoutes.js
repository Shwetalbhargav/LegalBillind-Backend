import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import {
  validateCreateEmailEntry,
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
} from '../controllers/emailEntryController.js';

const router = Router();

router.use(authenticate);

// Core ingest & listing
router.post('/', validateCreateEmailEntry, createEmailEntry);
router.get('/', listEmailEntries);

// Optional: batch ingest from the Chrome extension
router.post('/bulk', bulkIngest);

router.get('/:id', getEmailEntryById);

// Maintenance
router.patch('/:id', validateUpdateEmailEntry, updateEmailEntry);
router.delete('/:id', deleteEmailEntry);

// Mapping + GPT + derivatives
router.post('/:id/map', mapEmailEntry);
router.post('/:id/gpt-narrative', generateNarrative);
router.post('/:id/activity', createActivityFromEmail);
router.post('/:id/time-entry', createTimeEntryFromEmail);

// Integrations
router.post('/:id/sync-zoho', syncEmailEntryToZoho);

export default router;
