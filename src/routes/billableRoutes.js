import express from 'express';
import {
  createBillable,
  getAllBillables,
  getBillableById,
  updateBillable,
  deleteBillable,
  createBillableFromEmail
} from '../controllers/billableController.js';

const router = express.Router();

router.post('/', createBillable);
router.get('/', getAllBillables);
router.get('/:id', getBillableById);
router.put('/:id', updateBillable);
router.delete('/:id', deleteBillable);
router.post('/from-email/:emailEntryId', createBillableFromEmail);
export default router;
