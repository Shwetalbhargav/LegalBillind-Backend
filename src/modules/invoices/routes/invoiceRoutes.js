import { Router } from 'express';
import { authenticate, authorize } from '../../../middleware/auth.js';
import {
  validateGenerateFromBillables,
  validateGenerateFromTime,
  validateSendInvoice,
} from '../validators/invoiceValidators.js';
import {
  getAllInvoices,
  getInvoiceById,
  generateFromApprovedTime,
  generateFromApprovedBillables,
  sendInvoice,
  downloadInvoicePdf,
  previewInvoiceHtml,
  voidInvoice,
  getPipeline,
  getPendingSummaryByClient
} from '../controllers/invoiceController.js';

const router = Router();

router.use(authenticate);

router.get('/', getAllInvoices);
router.post('/from-time', validateGenerateFromTime, generateFromApprovedTime);
router.post('/from-billables', authorize('admin'), validateGenerateFromBillables, generateFromApprovedBillables);
router.get('/__analytics/pending-by-client', getPendingSummaryByClient);
router.get('/__pipeline', getPipeline);
router.get('/:id', getInvoiceById);
router.get('/:id/pdf', downloadInvoicePdf);
router.get('/:id/document', previewInvoiceHtml);
router.post('/:id/send', validateSendInvoice, sendInvoice);
router.post('/:id/void', voidInvoice);

export default router;
