import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import { ActivityController } from '../controllers/activityController.js';
import { validateCreateActivity } from '../validators/activityValidators.js';

const router = Router();

router.use(authenticate);

router.post('/', validateCreateActivity, ActivityController.create);
router.get('/', ActivityController.list);

export default router;
