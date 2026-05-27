import express from 'express';
import { authenticate, authorize } from '../../../middleware/auth.js';
import {
  validateCreateBillable,
  validateUpdateBillable,
} from '../validators/billableValidators.js';
import {
  createBillable,
  getAllBillables,
  getBillableById,
  updateBillable,
  deleteBillable,
  createFromEmail,
  approveBillable,
  rejectBillable
  } from '../controllers/billableController.js';

const router = express.Router();

router.use(authenticate);

router.post('/', validateCreateBillable, createBillable);
router.get('/', getAllBillables);
router.post('/from-email/:emailEntryId', createFromEmail);
router.post('/:id/approve', authorize('admin'), approveBillable);
router.post('/:id/reject', authorize('admin'), rejectBillable);
router.get('/:id', getBillableById);
router.put('/:id', validateUpdateBillable, updateBillable);
router.delete('/:id', deleteBillable);
export default router;
