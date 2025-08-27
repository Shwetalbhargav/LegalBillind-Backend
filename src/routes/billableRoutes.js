import express from 'express';
import {
  createBillable,
  getAllBillables,
  getBillableById,
  updateBillable,
  deleteBillable
} from '../controllers/billableController.js';

const router = express.Router();

router.post('/', createBillable);
router.get('/', getAllBillables);
router.get('/:id', getBillableById);
router.put('/:id', updateBillable);
router.delete('/:id', deleteBillable);

export default router;
