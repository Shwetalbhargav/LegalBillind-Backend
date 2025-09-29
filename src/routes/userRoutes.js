// routes/userRoutes.js
import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { listUsers, getMe } from "../controllers/userController.js";

const router = express.Router();

// Logged-in user info (any role)
router.get("/me", authenticate, getMe);

// Fetch users for frontend with role filter, etc.
// Example policy: only 'admin' and 'partner' can list users
router.get("/", authenticate, authorize("admin", "partner"), listUsers);

export default router;
