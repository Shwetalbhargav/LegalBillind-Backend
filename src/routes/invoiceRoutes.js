// src/routes/invoiceRoutes.js
import { Router } from 'express';
import {
  getAllInvoices,
  getInvoiceById,
  generateFromApprovedTime,
  sendInvoice,
  voidInvoice,
  getPipeline,
} from '../controllers/invoiceController.js';

const router = Router();

router.get('/', getAllInvoices);
router.get('/__pipeline', getPipeline);
router.get('/:id', getInvoiceById);
router.post('/from-time', generateFromApprovedTime);
router.post('/:id/send', sendInvoice);
router.post('/:id/void', voidInvoice);

export default router;