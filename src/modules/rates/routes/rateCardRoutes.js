import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import {
  validateCreateRateCard,
  validateResolveRate,
  validateUpdateRateCard,
} from '../validators/rateCardValidators.js';
import {
  listRateCards,
  createRateCard,
  updateRateCard,
  deleteRateCard,
  resolveRate,
} from '../controllers/rateCardController.js';

const router = Router();

router.use(authenticate);

router.get('/', listRateCards);
router.post('/', validateCreateRateCard, createRateCard);
router.get('/resolve', validateResolveRate, resolveRate);
router.put('/:id', validateUpdateRateCard, updateRateCard);
router.delete('/:id', deleteRateCard);

export default router;
