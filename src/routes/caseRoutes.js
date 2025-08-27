import express from 'express';
import {
  createCase,
  getAllCases,
  getCaseById,
  updateCase,
  deleteCase
} from '../controllers/caseController.js';

const router = express.Router();

router.get('/', getAllCases);
router.post('/create', createCase);
router.get('/:caseId', getCaseById);
router.put('/:caseId/update', updateCase);
router.delete('/:caseId/delete', deleteCase);

export default router;
