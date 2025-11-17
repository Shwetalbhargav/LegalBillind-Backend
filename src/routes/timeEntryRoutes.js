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

/**
 * Examples:
 *  POST /api/time-entries
 *  POST /api/time-entries/from-activity/:activityId
 *  GET  /api/time-entries?userId=<uid>&status=submitted&from=2025-09-01&to=2025-09-30
 *  PATCH /api/time-entries/:id
 *  POST /api/time-entries/:id/submit
 *  POST /api/time-entries/:id/approve
 *  POST /api/time-entries/:id/reject
 */
router.post('/', createTimeEntry);
router.post('/from-activity/:activityId', createFromActivity);
router.get('/', listTimeEntries);
router.patch('/:id', updateTimeEntry);
router.post('/:id/submit', submitTimeEntry);
router.post('/:id/approve', approveTimeEntry);
router.post('/:id/reject', rejectTimeEntry);

export default router;
