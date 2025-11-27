// src/routes/billableRoutes.js

import express from 'express';
import {
  createBillable,
  getAllBillables,
  getBillableById,
  updateBillable,
  deleteBillable,
  createFromEmail
  } from '../controllers/billableController.js';

const router = express.Router();

router.post('/', createBillable);
router.get('/', getAllBillables);
router.get('/:id', getBillableById);
router.put('/:id', updateBillable);
router.delete('/:id', deleteBillable);
router.post('/from-email/:emailEntryId', createFromEmail);
export default router;
