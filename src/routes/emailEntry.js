// src/routes/emailEntryRoutes.js
import { Router } from 'express';
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
  pushEmailEntryToClio,
  bulkIngest,
} from '../controllers/emailEntryController.js';

const router = Router();

// Core ingest & listing
router.post('/email-entries', createEmailEntry);
router.get('/email-entries', listEmailEntries);
router.get('/email-entries/:id', getEmailEntryById);

// Maintenance
router.patch('/email-entries/:id', updateEmailEntry);
router.delete('/email-entries/:id', deleteEmailEntry);

// Mapping + GPT + derivatives
router.post('/email-entries/:id/map', mapEmailEntry);
router.post('/email-entries/:id/gpt-narrative', generateNarrative);
router.post('/email-entries/:id/activity', createActivityFromEmail);
router.post('/email-entries/:id/time-entry', createTimeEntryFromEmail);

// Integrations
router.post('/email-entries/:id/push-clio', pushEmailEntryToClio);

// Optional: batch ingest from the Chrome extension
router.post('/email-entries/bulk', bulkIngest);

export default router;
