import { Router } from 'express';
import { authenticate, authorize } from '../../../middleware/auth.js';
import { CaseAssignmentController } from '../controllers/caseAssignmentController.js';
import {
  normalizeAssignmentPayload,
  rejectUnknownAssignmentCreateFields,
  rejectUnknownAssignmentUpdateFields,
  requireAssignmentUpdateFields,
  validateAssignmentIdParam,
  validateAssignmentQuery,
  validateCaseIdParam,
  validateCreateCaseAssignment,
  validateUpdateCaseAssignment,
} from '../validators/caseValidators.js';

const router = Router();

router.use(authenticate);

const canReadAssignments = authorize('admin', 'partner', 'lawyer', 'associate', 'intern');
const canWriteAssignments = authorize('admin', 'partner', 'lawyer');

router.post(
  '/',
  canWriteAssignments,
  rejectUnknownAssignmentCreateFields,
  normalizeAssignmentPayload,
  validateCreateCaseAssignment,
  CaseAssignmentController.assign
);
router.get('/', canReadAssignments, validateAssignmentQuery, CaseAssignmentController.list);
router.get('/timeline/:caseId', canReadAssignments, validateCaseIdParam, CaseAssignmentController.staffingTimeline);
router.get('/:id', canReadAssignments, validateAssignmentIdParam, CaseAssignmentController.getById);
router.put(
  '/:id',
  canWriteAssignments,
  validateAssignmentIdParam,
  rejectUnknownAssignmentUpdateFields,
  normalizeAssignmentPayload,
  requireAssignmentUpdateFields,
  validateUpdateCaseAssignment,
  CaseAssignmentController.update
);
router.delete('/:id', canWriteAssignments, validateAssignmentIdParam, CaseAssignmentController.remove);

export default router;
