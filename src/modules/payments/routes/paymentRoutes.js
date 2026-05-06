import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import {
  validateCreatePayment,
  validateReconcilePayment,
} from '../validators/paymentValidators.js';
import {
  listPayments,
  createPayment,
  reconcilePayment,
  deletePayment,
} from '../controllers/paymentController.js';

const router = Router();

router.use(authenticate);

/**
 * Examples:
 *  GET  /api/payments?invoiceId=<id>&status=cleared&from=2025-01-01&to=2025-01-31
 *  POST /api/payments
 *  POST /api/payments/:id/reconcile
 *  DELETE /api/payments/:id
 */
router.get('/', listPayments);
router.post('/', validateCreatePayment, createPayment);
router.post('/:id/reconcile', validateReconcilePayment, reconcilePayment);
router.delete('/:id', deletePayment);

export default router;
