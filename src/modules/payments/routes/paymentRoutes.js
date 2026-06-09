import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import {
  validateCreatePayment,
  validatePortalPayment,
  validateReconcilePayment,
  validateWriteOff,
} from '../validators/paymentValidators.js';
import {
  listPayments,
  createPayment,
  createPortalLink,
  createWriteOff,
  financeSummary,
  getPortalInvoice,
  reconcilePayment,
  submitPortalPayment,
  deletePayment,
} from '../controllers/paymentController.js';

const router = Router();

router.get('/portal/:token', getPortalInvoice);
router.post('/portal/:token/pay', validatePortalPayment, submitPortalPayment);

router.use(authenticate);

/**
 * Examples:
 *  GET  /api/payments?invoiceId=<id>&status=cleared&from=2025-01-01&to=2025-01-31
 *  POST /api/payments
 *  POST /api/payments/:id/reconcile
 *  DELETE /api/payments/:id
 */
router.get('/', listPayments);
router.get('/finance-summary', financeSummary);
router.post('/', validateCreatePayment, createPayment);
router.post('/write-off', validateWriteOff, createWriteOff);
router.post('/portal-link/:invoiceId', createPortalLink);
router.post('/:id/reconcile', validateReconcilePayment, reconcilePayment);
router.delete('/:id', deletePayment);

export default router;
