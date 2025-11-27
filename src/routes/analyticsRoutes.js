// src/routes/analyticsRoutes.js

import express from 'express';
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

router.get('/billables', getBillableStats);
router.get('/invoices', getInvoiceStats);
router.get('/unbilled', getUnbilledBillables);
router.get('/billables-by-case-type', getBillableStatsByCaseType);
router.get('/analytics/unbilled-by-client', getUnbilledStatsByClient);
router.get('/analytics/unbilled-by-user', getUnbilledStatsByUser);
router.get('/analytics/billed-by-client', getBilledStatsByClient);
router.get('/analytics/billed-by-user', getBilledStatsByUser);
export default router;
