// src/routes/paymentRoutes.js
import { Router } from 'express';
import {
  listPayments,
  createPayment,
  reconcilePayment,
  deletePayment,
} from '../controllers/paymentController.js';

const router = Router();

/**
 * Examples:
 *  GET  /api/payments?invoiceId=<id>&status=cleared&from=2025-01-01&to=2025-01-31
 *  POST /api/payments
 *  POST /api/payments/:id/reconcile
 *  DELETE /api/payments/:id
 */
router.get('/', listPayments);
router.post('/', createPayment);
router.post('/:id/reconcile', reconcilePayment);
router.delete('/:id', deletePayment);

export default router;
