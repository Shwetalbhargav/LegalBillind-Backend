// src/routes/analyticsRoutes.js

import express from 'express';
import {
  getBillableStats,
  getInvoiceStats,
  getUnbilledBillables,
  getBillableStatsByCaseType
} from '../controllers/analyticsController.js';

const router = express.Router();

router.get('/billables', getBillableStats);
router.get('/invoices', getInvoiceStats);
router.get('/unbilled', getUnbilledBillables);
router.get('/billables-by-case-type', getBillableStatsByCaseType);
export default router;
