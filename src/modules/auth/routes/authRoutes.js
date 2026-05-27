// src/routes/authRoutes.js

import express from 'express';
import { authenticate } from '../../../middleware/auth.js';
import { getCurrentUser, issueExtensionToken, loginUser, logoutUser, registerUser } from '../controllers/authController.js';
import { validateLogin, validateRegister } from '../validators/authValidators.js';

const router = express.Router();

router.post('/login', validateLogin, loginUser);
router.post('/register', validateRegister, registerUser);
router.post('/logout', logoutUser);
router.get('/me', authenticate, getCurrentUser);
router.post('/extension-token', authenticate, issueExtensionToken);

export default router;
