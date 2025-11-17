// src/routes/activityRoutes.js
import { Router } from 'express';
import { ActivityController } from '../controllers/activityController.js';
// import auth middleware if you have it: import { requireAuth } from '../middleware/auth.js';

const router = Router();

// router.use(requireAuth);

router.post('/activities', ActivityController.create);
router.get('/activities', ActivityController.list);

export default router;
