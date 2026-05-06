import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import {
  validateGenerateFromTime,
  validateSendInvoice,
} from '../validators/invoiceValidators.js';
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

router.use(authenticate);

router.get('/', getAllInvoices);
router.post('/from-time', validateGenerateFromTime, generateFromApprovedTime);
router.get('/__analytics/pending-by-client', getPendingSummaryByClient);
router.get('/__pipeline', getPipeline);
router.get('/:id', getInvoiceById);
router.post('/:id/send', validateSendInvoice, sendInvoice);
router.post('/:id/void', voidInvoice);

export default router;
