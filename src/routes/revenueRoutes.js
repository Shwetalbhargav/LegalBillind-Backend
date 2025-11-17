// src/routes/revenueRoutes.js
import { Router } from 'express';
import { getRevenueBreakdown, getMonthlyRevenue } from '../controllers/revenueController.js';

const router = Router();

/**
 * Examples:
 *  GET /api/revenue/breakdown?groupBy=client&from=2025-01-01&to=2025-03-31
 *  GET /api/revenue/monthly?months=12
 */
router.get('/breakdown', getRevenueBreakdown);
router.get('/monthly', getMonthlyRevenue);

export default router;
