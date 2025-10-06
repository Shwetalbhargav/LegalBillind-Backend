// File: routes/adminRoutes.js
import express from "express";
import { registerAdmin, loginAdmin, getMe, updateMe, getDashboard } from "../controllers/adminController.js";
import { protect, adminOnly } from "../middleware/auth.js";

const router = express.Router();

// Auth
router.post("/register", registerAdmin);
router.post("/login", loginAdmin);

// Me
router.get("/me", protect, adminOnly, getMe);
router.patch("/me", protect, adminOnly, updateMe);

// Dashboard
router.get("/dashboard", protect, adminOnly, getDashboard);

export default router;
