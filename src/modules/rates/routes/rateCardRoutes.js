import { Router } from 'express';
import { authenticate, authorize } from '../../../middleware/auth.js';
import {
  validateCreateRateCard,
  validateListRateCards,
  validateRateCardIdParam,
  validateResolveRate,
  validateUpdateRateCard,
} from '../validators/rateCardValidators.js';
import {
  listRateCards,
  createRateCard,
  getRateCardById,
  updateRateCard,
  deleteRateCard,
  resolveRate,
} from '../controllers/rateCardController.js';

const router = Router();

router.use(authenticate);

router.get('/', authorize('admin'), validateListRateCards, listRateCards);
router.post('/', authorize('admin'), validateCreateRateCard, createRateCard);
router.get('/resolve', validateResolveRate, resolveRate);
router.get('/:id', authorize('admin'), validateRateCardIdParam, getRateCardById);
router.put('/:id', authorize('admin'), validateRateCardIdParam, validateUpdateRateCard, updateRateCard);
router.delete('/:id', authorize('admin'), validateRateCardIdParam, deleteRateCard);

export default router;
