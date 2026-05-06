import express from 'express';
import { authenticate } from '../../../middleware/auth.js';
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
  createFromEmail
  } from '../controllers/billableController.js';

const router = express.Router();

router.use(authenticate);

router.post('/', validateCreateBillable, createBillable);
router.get('/', getAllBillables);
router.post('/from-email/:emailEntryId', createFromEmail);
router.get('/:id', getBillableById);
router.put('/:id', validateUpdateBillable, updateBillable);
router.delete('/:id', deleteBillable);
export default router;
