import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import { TaskController } from '../controllers/taskController.js';
import {
  validateCreateTask,
  validateListTasks,
  validateTaskId,
  validateUpdateTask,
} from '../validators/taskValidators.js';

const router = Router();

router.use(authenticate);

router.get('/', validateListTasks, TaskController.list);
router.post('/', validateCreateTask, TaskController.create);
router.get('/:taskId', validateTaskId, TaskController.getById);
router.patch('/:taskId', validateTaskId, validateUpdateTask, TaskController.update);
router.delete('/:taskId', validateTaskId, TaskController.remove);

export default router;
