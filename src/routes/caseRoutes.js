import express from 'express';
import {
  createCase,
  getAllCases,
  getCaseById,
  updateCase,
  deleteCase,
  listCaseTypes
} from '../controllers/caseController.js';

const router = express.Router();

router.get('/', getAllCases);
router.post('/create', createCase);
router.get('/:caseId', getCaseById);
router.put('/:caseId/update', updateCase);
router.delete('/:caseId/delete', deleteCase);
router.get('/__meta/case-types', listCaseTypes);
export default router;
