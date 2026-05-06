import { Router } from 'express';
import { authenticate, authorize } from '../../../middleware/auth.js';
import {
  validateCreateUser,
  validateUpdateUser,
} from '../validators/userValidators.js';
import {
  createUser,
  updateUser,
  deleteUser,
  listUsers,
  getUserById,
  getMe,
  getUserProfile,
  upsertUserProfile,
  getUserDefaultRate,
  getMyScopes,
} from '../controllers/userController.js';

const router = Router();

router.use(authenticate);

/**
 * Examples:
 *  POST   /api/users
 *  GET    /api/users?role=associate&q=ananya
 *  GET    /api/users/:id
 *  PUT    /api/users/:id
 *  DELETE /api/users/:id
 *  GET    /api/users/:id/profile
 *  PUT    /api/users/:id/profile
 *  GET    /api/users/:id/default-rate
 *  GET    /api/users/me
 *  GET    /api/users/me/scopes
 */
router.post('/', authorize('admin', 'partner'), validateCreateUser, createUser);
router.get('/', authorize('admin', 'partner'), listUsers);

router.get('/me/self', getMyScopes); // keep /me route unshadowed
router.get('/me', getMe);

router.get('/:id', getUserById);
router.put('/:id', authorize('admin', 'partner'), validateUpdateUser, updateUser);
router.delete('/:id', authorize('admin'), deleteUser);

router.get('/:id/profile', getUserProfile);
router.put('/:id/profile', authorize('admin', 'partner'), upsertUserProfile);
router.get('/:id/default-rate', getUserDefaultRate);

export default router;
