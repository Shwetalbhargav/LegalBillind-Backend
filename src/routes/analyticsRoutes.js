import express from 'express';
import {
  getBillableStats,
  getInvoiceStats,
  getUnbilledBillables
} from '../controllers/analyticsController.js';

const router = express.Router();

router.get('/billables', getBillableStats);
router.get('/invoices', getInvoiceStats);
router.get('/unbilled', getUnbilledBillables);

export default router;
