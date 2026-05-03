// src/routes/invoiceRoutes.js
import { Router } from 'express';
import {
  getAllInvoices,
  getInvoiceById,
  generateFromApprovedTime,
  sendInvoice,
  voidInvoice,
  getPipeline,
  getPendingSummaryByClient
} from '../controllers/invoiceController.js';

const router = Router();

router.get('/', getAllInvoices);
router.post('/from-time', generateFromApprovedTime);
router.get('/__analytics/pending-by-client', getPendingSummaryByClient);
router.get('/__pipeline', getPipeline);
router.get('/:id', getInvoiceById);
router.post('/:id/send', sendInvoice);
router.post('/:id/void', voidInvoice);

export default router;
