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
router.get('/__pipeline', getPipeline);
router.get('/:id', getInvoiceById);
router.post('/from-time', generateFromApprovedTime);
router.post('/:id/send', sendInvoice);
router.post('/:id/void', voidInvoice);
router.get('/pending-summary/by-client', getPendingSummaryByClient);

export default router;