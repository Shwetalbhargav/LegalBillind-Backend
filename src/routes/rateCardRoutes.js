// src/routes/rateCardRoutes.js
import { Router } from 'express';
import {
  listRateCards,
  createRateCard,
  updateRateCard,
  deleteRateCard,
  resolveRate,
} from '../controllers/rateCardController.js';

const router = Router();

/**
 * Examples:
 *  GET    /api/rate-cards?userId=<uid>&activeOn=2025-09-01
 *  POST   /api/rate-cards
 *  PUT    /api/rate-cards/:id
 *  DELETE /api/rate-cards/:id
 *  GET    /api/rate-cards/resolve?userId=<uid>&caseId=<cid>&activityCode=DRAFT&at=2025-09-15
 */
router.get('/', listRateCards);
router.post('/', createRateCard);
router.put('/:id', updateRateCard);
router.delete('/:id', deleteRateCard);
router.get('/resolve', resolveRate);

export default router;
