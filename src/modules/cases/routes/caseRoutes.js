import { Router } from 'express';
import { authenticate, authorize } from '../../../middleware/auth.js';
import {
  normalizeCasePayload,
  rejectUnknownCaseFields,
  rejectUnknownCaseStatusFields,
  validateCaseStatus,
  validateCaseIdParam,
  validateCaseRollupQuery,
  validateCreateCase,
  validateClientIdParam,
  validateListCasesQuery,
  validateRelatedCaseQuery,
  validateUpdateCase,
  requireCaseBodyFields,
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

const canReadCases = authorize('admin', 'partner', 'lawyer', 'associate', 'intern');
const canWriteCases = authorize('admin', 'partner', 'lawyer');
const canDeleteCases = authorize('admin');

// CRUD
router.post('/', canWriteCases, rejectUnknownCaseFields, normalizeCasePayload, validateCreateCase, createCase);
router.get('/', canReadCases, validateListCasesQuery, getAllCases);

// Convenience
router.get('/by-client/:clientId', canReadCases, validateClientIdParam, validateListCasesQuery, getCasesByClient);

router.get('/:caseId', canReadCases, validateCaseIdParam, getCaseById);
router.put(
  '/:caseId',
  canWriteCases,
  validateCaseIdParam,
  rejectUnknownCaseFields,
  normalizeCasePayload,
  requireCaseBodyFields,
  validateUpdateCase,
  updateCase
);
router.delete('/:caseId', canDeleteCases, validateCaseIdParam, deleteCase);

// Status transition
router.patch(
  '/:caseId/status',
  canWriteCases,
  validateCaseIdParam,
  rejectUnknownCaseStatusFields,
  normalizeCasePayload,
  validateCaseStatus,
  transitionStatus
);

// Related lists
router.get('/:caseId/time-entries', canReadCases, validateCaseIdParam, validateRelatedCaseQuery, listCaseTimeEntries);
router.get('/:caseId/invoices', canReadCases, validateCaseIdParam, listCaseInvoices);
router.get('/:caseId/payments', canReadCases, validateCaseIdParam, listCasePayments);

// Rollup (WIP/Billed/AR)
router.get('/:caseId/rollup', canReadCases, validateCaseIdParam, validateCaseRollupQuery, caseRollup);

export default router;
