import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import { ArController } from '../controllers/arController.js';

const router = Router();

router.use(authenticate);

// A/R aging totals (optional ?clientId=&asOf=&clearedOnly=)
router.get('/aging', ArController.aging);

// A/R aging grouped by client
router.get('/aging/by-client', ArController.agingByClient);

export default router;
