// routes/teamAssignmentRoutes.js
import express from 'express';
import { assignUserToCase, getCaseTeam, removeUserFromCase } from '../controllers/teamAssignmentController.js';

const router = express.Router();

router.post('/assign', assignUserToCase);
router.get('/:caseId', getCaseTeam);
router.delete('/remove', removeUserFromCase);

export default router;
