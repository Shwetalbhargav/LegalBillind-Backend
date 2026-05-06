import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import { CaseAssignmentController } from '../controllers/caseAssignmentController.js';

const router = Router();

router.use(authenticate);

router.post('/', CaseAssignmentController.assign);
router.get('/', CaseAssignmentController.list);
router.get('/timeline/:caseId', CaseAssignmentController.staffingTimeline);
router.delete('/:id', CaseAssignmentController.remove);

export default router;
