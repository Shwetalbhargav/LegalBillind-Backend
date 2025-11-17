// src/routes/caseRoutes.js
import { Router } from 'express';
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

// CRUD
router.post('/cases', createCase);
router.get('/cases', getAllCases);
router.get('/cases/:caseId', getCaseById);
router.put('/cases/:caseId', updateCase);
router.delete('/cases/:caseId', deleteCase);

// Status transition
router.patch('/cases/:caseId/status', transitionStatus);

// Related lists
router.get('/cases/:caseId/time-entries', listCaseTimeEntries);
router.get('/cases/:caseId/invoices', listCaseInvoices);
router.get('/cases/:caseId/payments', listCasePayments);

// Rollup (WIP/Billed/AR)
router.get('/cases/:caseId/rollup', caseRollup);

// Convenience
router.get('/cases/by-client/:clientId', getCasesByClient);

export default router;
