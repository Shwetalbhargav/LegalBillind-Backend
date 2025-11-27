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


router.get('/', listRateCards);
router.post('/', createRateCard);
router.put('/:id', updateRateCard);
router.delete('/:id', deleteRateCard);
router.get('/resolve', resolveRate);

export default router;
