// src/routes/caseAssignmentRoutes.js
import { Router } from 'express';
import { CaseAssignmentController } from '../controllers/caseAssignmentController.js';

const router = Router();

router.post('/case-assignments', CaseAssignmentController.assign);
router.delete('/case-assignments/:id', CaseAssignmentController.remove);
router.get('/case-assignments', CaseAssignmentController.list);
router.get('/case-assignments/timeline/:caseId', CaseAssignmentController.staffingTimeline);

export default router;
