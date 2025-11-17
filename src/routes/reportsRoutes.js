// src/routes/reportsRoutes.js
import { Router } from 'express';
import {
  exportTimeEntriesCsv,
  exportInvoicesCsv,
  exportUtilizationCsv,
  exportPdf,
} from '../controllers/reportsController.js';

const router = Router();

/**
 * Examples:
 *  GET /api/reports/time-entries.csv?from=2025-09-01&to=2025-09-30&userId=<uid>
 *  GET /api/reports/invoices.csv?from=2025-09-01&to=2025-09-30&status=sent
 *  GET /api/reports/utilization.csv?from=2025-09-01&to=2025-09-30&groupBy=user
 *  GET /api/reports/pdf
 */
router.get('/time-entries.csv', exportTimeEntriesCsv);
router.get('/invoices.csv', exportInvoicesCsv);
router.get('/utilization.csv', exportUtilizationCsv);
router.get('/pdf', exportPdf);

export default router;
