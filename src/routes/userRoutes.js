// src/routes/userRoutes.js
import { Router } from 'express';
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
router.post('/', createUser);
router.get('/', listUsers);
router.get('/:id', getUserById);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

router.get('/:id/profile', getUserProfile);
router.put('/:id/profile', upsertUserProfile);
router.get('/:id/default-rate', getUserDefaultRate);

router.get('/me/self', getMyScopes); // keep /me route unshadowed
router.get('/me', getMe);

export default router;
