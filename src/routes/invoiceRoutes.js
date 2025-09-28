// routes/invoiceRoutes.js
import express from 'express';
import {
  createInvoice,
  getInvoiceById,
  getAllInvoices,
  getInvoicesByUser,
  addPayment,
  getPendingSummaryByClient
} from '../controllers/invoiceController.js';

const router = express.Router();

router.post('/', createInvoice);
router.get('/', getAllInvoices);
router.get('/__analytics/pending-by-client', getPendingSummaryByClient);
router.post('/:id/payments', addPayment);
router.get('/user/:userId', getInvoicesByUser);
router.get('/:id', getInvoiceById);

export default router;
