import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import {
  validateActivityIdParam,
  validateCreateTimeEntry,
  validateUpdateTimeEntry,
} from '../validators/timeEntryValidators.js';
import {
  createTimeEntry,
  createFromActivity,
  listTimeEntries,
  updateTimeEntry,
  submitTimeEntry,
  approveTimeEntry,
  rejectTimeEntry,
} from '../controllers/timeEntryController.js';

const router = Router();

router.use(authenticate);

router.post('/', validateCreateTimeEntry, createTimeEntry);
router.post('/from-activity/:activityId', validateActivityIdParam, createFromActivity);
router.get('/', listTimeEntries);
router.patch('/:id', validateUpdateTimeEntry, updateTimeEntry);
router.post('/:id/submit', submitTimeEntry);
router.post('/:id/approve', approveTimeEntry);
router.post('/:id/reject', rejectTimeEntry);

export default router;
