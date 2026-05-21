import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import { ActivityController } from '../controllers/activityController.js';
import {
  normalizeActivityReasonPayload,
  normalizeActivityPayload,
  rejectUnknownActivityReasonFields,
  rejectUnknownActivityCreateFields,
  rejectUnknownActivityUpdateFields,
  requireActivityUpdateFields,
  validateActivityIdParam,
  validateCreateActivity,
  validateActivityReason,
  validateListActivitiesQuery,
  validateUpdateActivity,
} from '../validators/activityValidators.js';

const router = Router();

router.use(authenticate);

router.post('/', normalizeActivityPayload, rejectUnknownActivityCreateFields, validateCreateActivity, ActivityController.create);
router.get('/', validateListActivitiesQuery, ActivityController.list);
router.get('/:activityId', validateActivityIdParam, ActivityController.getById);
router.patch('/:activityId', validateActivityIdParam, normalizeActivityPayload, rejectUnknownActivityUpdateFields, requireActivityUpdateFields, validateUpdateActivity, ActivityController.update);
router.post('/:activityId/review', validateActivityIdParam, ActivityController.review);
router.post('/:activityId/ignore', validateActivityIdParam, normalizeActivityReasonPayload, rejectUnknownActivityReasonFields, validateActivityReason, ActivityController.ignore);
router.post('/:activityId/lock', validateActivityIdParam, normalizeActivityReasonPayload, rejectUnknownActivityReasonFields, validateActivityReason, ActivityController.lock);
router.post('/:activityId/void', validateActivityIdParam, normalizeActivityReasonPayload, rejectUnknownActivityReasonFields, validateActivityReason, ActivityController.void);
router.delete('/:activityId', validateActivityIdParam, normalizeActivityReasonPayload, rejectUnknownActivityReasonFields, validateActivityReason, ActivityController.void);

export default router;
