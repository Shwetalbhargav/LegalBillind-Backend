// routes/adminRoutes.js
import express from "express";
import {
  registerAdmin,
  loginAdmin,
  getMe,
  updateMe,
  getDashboard,
} from "../controllers/adminController.js";
import { protect, adminOnly } from "../middleware/auth.js";

const router = express.Router();

/**
 * Auth
 */
router.post("/register", registerAdmin);
router.post("/login", loginAdmin);

/**
 * Profile (authenticated + admin)
 * If you later want non-admin staff to access /me, swap `adminOnly` with role(s) you prefer.
 */
router.get("/me", protect, adminOnly, getMe);
router.patch("/me", protect, adminOnly, updateMe);

/**
 * Dashboard (admin only)
 */
router.get("/dashboard", protect, adminOnly, getDashboard);

export default router;
