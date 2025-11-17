// src/routes/arRoutes.js
import { Router } from 'express';
import { ArController } from '../controllers/arController.js';

const router = Router();

// A/R aging totals (optional ?clientId=&asOf=&clearedOnly=)
router.get('/ar/aging', ArController.aging);

// A/R aging grouped by client
router.get('/ar/aging/by-client', ArController.agingByClient);

export default router;
