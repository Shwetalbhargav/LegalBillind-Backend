// src/routes/authRoutes.js

import express from 'express';
import { loginUser, logoutUser, registerUser } from '../controllers/authController.js';
import { validateLogin, validateRegister } from '../validators/authValidators.js';

const router = express.Router();

router.post('/login', validateLogin, loginUser);
router.post('/register', validateRegister, registerUser);
router.post('/logout', logoutUser);

export default router;
