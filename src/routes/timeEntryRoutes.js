// src/routes/timeEntryRoutes.js
import { Router } from 'express';
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


router.post('/', createTimeEntry);
router.post('/from-activity/:activityId', createFromActivity);
router.get('/', listTimeEntries);
router.patch('/:id', updateTimeEntry);
router.post('/:id/submit', submitTimeEntry);
router.post('/:id/approve', approveTimeEntry);
router.post('/:id/reject', rejectTimeEntry);

export default router;
