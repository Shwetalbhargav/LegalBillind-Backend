import express from 'express';
import { authenticate } from '../../../middleware/auth.js';
import {
  getBillableStats,
  getInvoiceStats,
  getUnbilledBillables,
  getBillableStatsByCaseType,
  getUnbilledStatsByClient,
  getUnbilledStatsByUser,
  getBilledStatsByClient,
  getBilledStatsByUser,
} from '../controllers/analyticsController.js';

const router = express.Router();

router.use(authenticate);

router.get('/billables', getBillableStats);
router.get('/invoices', getInvoiceStats);
router.get('/unbilled', getUnbilledBillables);
router.get('/billables-by-case-type', getBillableStatsByCaseType);
router.get('/unbilled-by-client', getUnbilledStatsByClient);
router.get('/unbilled-by-user', getUnbilledStatsByUser);
router.get('/billed-by-client', getBilledStatsByClient);
router.get('/billed-by-user', getBilledStatsByUser);
export default router;
