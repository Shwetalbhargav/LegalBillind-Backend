import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import {
  exportTimeEntriesCsv,
  exportInvoicesCsv,
  exportGstCsv,
  getGstSummary,
  exportUtilizationCsv,
  exportPdf,
} from '../controllers/reportsController.js';

const router = Router();

router.use(authenticate);

/**
 * Examples:
 *  GET /api/reports/time-entries.csv?from=2025-09-01&to=2025-09-30&userId=<uid>
 *  GET /api/reports/invoices.csv?from=2025-09-01&to=2025-09-30&status=sent
 *  GET /api/reports/utilization.csv?from=2025-09-01&to=2025-09-30&groupBy=user
 *  GET /api/reports/pdf
 */
router.get('/time-entries.csv', exportTimeEntriesCsv);
router.get('/invoices.csv', exportInvoicesCsv);
router.get('/gst-summary', getGstSummary);
router.get('/gst.csv', exportGstCsv);
router.get('/utilization.csv', exportUtilizationCsv);
router.get('/pdf', exportPdf);

export default router;
