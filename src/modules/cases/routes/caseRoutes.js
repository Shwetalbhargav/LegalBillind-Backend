import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import {
  validateCaseStatus,
  validateCreateCase,
  validateUpdateCase,
} from '../validators/caseValidators.js';
import {
  createCase,
  getAllCases,
  getCaseById,
  updateCase,
  deleteCase,
  transitionStatus,
  listCaseTimeEntries,
  listCaseInvoices,
  listCasePayments,
  caseRollup,
  getCasesByClient,
} from '../controllers/caseController.js';

const router = Router();

router.use(authenticate);

// CRUD
router.post('/', validateCreateCase, createCase);
router.get('/', getAllCases);

// Convenience
router.get('/by-client/:clientId', getCasesByClient);

router.get('/:caseId', getCaseById);
router.put('/:caseId', validateUpdateCase, updateCase);
router.delete('/:caseId', deleteCase);

// Status transition
router.patch('/:caseId/status', validateCaseStatus, transitionStatus);

// Related lists
router.get('/:caseId/time-entries', listCaseTimeEntries);
router.get('/:caseId/invoices', listCaseInvoices);
router.get('/:caseId/payments', listCasePayments);

// Rollup (WIP/Billed/AR)
router.get('/:caseId/rollup', caseRollup);

export default router;
