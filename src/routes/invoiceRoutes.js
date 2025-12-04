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
router.get('/:id', getInvoiceById);
router.post('/from-time', generateFromApprovedTime);
router.post('/:id/send', sendInvoice);
router.post('/:id/void', voidInvoice);
router.get('/__analytics/pending-by-client', getPendingSummaryByClient);
router.get('/__pipeline', getPipeline);

export default router;