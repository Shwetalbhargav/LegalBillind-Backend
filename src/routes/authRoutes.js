import express from 'express';
import { loginUser, registerUser, verifyEmail, consumeMagicLink, requestMagicLink } from '../controllers/authController.js';

const router = express.Router();

router.post('/login', loginUser);
router.post('/register', registerUser);
router.get('/verify-email', verifyEmail);
router.post('/magic/request', requestMagicLink);
router.get('/magic/consume', consumeMagicLink);
export default router;
