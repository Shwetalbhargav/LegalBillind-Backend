import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import { WorkSessionController } from '../controllers/workSessionController.js';
import {
  validateDiscardWorkSession,
  validateHeartbeatWorkSession,
  validatePauseWorkSession,
  validateStartWorkSession,
  validateStopWorkSession,
  validateWorkSessionId,
} from '../validators/workSessionValidators.js';

const router = Router();

router.use(authenticate);

router.post('/start', validateStartWorkSession, WorkSessionController.start);
router.get('/current', WorkSessionController.current);
router.get('/', WorkSessionController.list);
router.post('/:id/heartbeat', validateWorkSessionId, validateHeartbeatWorkSession, WorkSessionController.heartbeat);
router.post('/:id/pause', validateWorkSessionId, validatePauseWorkSession, WorkSessionController.pause);
router.post('/:id/resume', validateWorkSessionId, WorkSessionController.resume);
router.post('/:id/stop', validateWorkSessionId, validateStopWorkSession, WorkSessionController.stop);
router.post('/:id/discard', validateWorkSessionId, validateDiscardWorkSession, WorkSessionController.discard);

export default router;
