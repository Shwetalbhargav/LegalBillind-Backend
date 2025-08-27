// routes/invoiceRoutes.js
import express from 'express';
import {
  createInvoice,
  getInvoiceById,
  getAllInvoices,
  getInvoicesByUser
} from '../controllers/invoiceController.js';

const router = express.Router();

router.post('/', createInvoice);
router.get('/', getAllInvoices);
router.get('/user/:userId', getInvoicesByUser);
router.get('/:id', getInvoiceById);

export default router;
