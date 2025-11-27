// src/routes/lawyerProfileRoutes.js
import express from "express";
import {
  createLawyerProfile,
  listLawyerProfiles,
  getLawyerProfile,
  updateLawyerProfile,
  deleteLawyerProfile,
  getLawyerProfileByUser,
  getMyLawyerProfile,
  updateMyLawyerProfile,
  deleteMyLawyerProfile,
  lawyerDashboard
} from "../controllers/lawyerProfileController.js";

import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

/* ================================
   ADMIN / PARTNER MANAGEMENT APIs
   ================================ */

// Create profile
router.post(
  "/",
  authenticate,
  authorize("admin", "partner"),
  createLawyerProfile
);

// List all lawyer profiles
router.get(
  "/",
  authenticate,
  authorize("admin", "partner"),
  listLawyerProfiles
);

// Get by profile ID -> ?id=
router.get(
  "/by-id",
  authenticate,
  authorize("admin", "partner"),
  getLawyerProfile
);

// Get by userId -> ?userId=
router.get(
  "/by-user",
  authenticate,
  authorize("admin", "partner"),
  getLawyerProfileByUser
);

// Update lawyer profile (body: { id, ...updates })
router.put(
  "/",
  authenticate,
  authorize("admin", "partner"),
  updateLawyerProfile
);

// Delete lawyer profile (body: { id })
router.delete(
  "/",
  authenticate,
  authorize("admin", "partner"),
  deleteLawyerProfile
);

/* ================================
   SELF SERVICE — LAWYER WORKSPACE
   ================================ */

// Get my profile
router.get(
  "/me",
  authenticate,
  authorize("lawyer"),
  getMyLawyerProfile
);

// Update my own profile
router.patch(
  "/me",
  authenticate,
  authorize("lawyer"),
  updateMyLawyerProfile
);

// Delete my profile
router.delete(
  "/me",
  authenticate,
  authorize("lawyer"),
  deleteMyLawyerProfile
);

/* ================================
   DASHBOARD
   ================================ */

router.get(
  "/dashboard",
  authenticate,
  authorize("admin", "partner"),
  lawyerDashboard
);

export default router;
