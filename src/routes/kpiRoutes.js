// src/routes/kpiRoutes.js
import { Router } from 'express';
import { getKpiSummary, getKpiTrend } from '../controllers/kpiController.js';

const router = Router();

/**
 * Examples:
 *  GET /api/kpi/summary?scope=firm&month=2025-09
 *  GET /api/kpi/summary?scope=client&scopeId=<clientId>&from=2025-01-01&to=2025-03-31
 *  GET /api/kpi/trend?metric=revenue&months=6&scope=user&scopeId=<userId>
 */
router.get('/summary', getKpiSummary);
router.get('/trend', getKpiTrend);

export default router;
