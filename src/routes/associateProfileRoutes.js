// routes/associateProfileRoutes.js
import express from "express";
import {
  createAssociateProfile,
  listAssociateProfiles,
  getAssociateProfile,
  updateAssociateProfile,
  deleteAssociateProfile,
  getAssociateProfileByUser,
  getMyAssociateProfile,
  updateMyAssociateProfile,
  deleteMyAssociateProfile,
  associateDashboard,
} from "../controllers/associateProfileController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

/**
 * ADMIN / SYSTEM CRUD
 *
 * POST    /api/associate-profiles
 * GET     /api/associate-profiles
 * GET     /api/associate-profiles/by-id?id=
 * PATCH   /api/associate-profiles
 * DELETE  /api/associate-profiles
 * GET     /api/associate-profiles/by-user?userId=
 */

router.post(
  "/",
  authenticate,
  authorize("admin", "partner"),
  createAssociateProfile
);

router.get(
  "/",
  authenticate,
  authorize("admin", "partner"),
  listAssociateProfiles
);

router.get(
  "/by-id",
  authenticate,
  authorize("admin", "partner"),
  getAssociateProfile
);

router.patch(
  "/",
  authenticate,
  authorize("admin", "partner"),
  updateAssociateProfile
);

router.delete(
  "/",
  authenticate,
  authorize("admin", "partner"),
  deleteAssociateProfile
);

router.get(
  "/by-user",
  authenticate,
  authorize("admin", "partner"),
  getAssociateProfileByUser
);

/**
 * SELF APIs (for logged-in associate)
 *
 * GET    /api/associate-profiles/me
 * PATCH  /api/associate-profiles/me
 * DELETE /api/associate-profiles/me
 */

router.get(
  "/me",
  authenticate,
  authorize("associate"),
  getMyAssociateProfile
);

router.patch(
  "/me",
  authenticate,
  authorize("associate"),
  updateMyAssociateProfile
);

router.delete(
  "/me",
  authenticate,
  authorize("associate"),
  deleteMyAssociateProfile
);

/**
 * DASHBOARD
 *
 * GET /api/associate-profiles/dashboard
 */

router.get(
  "/dashboard",
  authenticate,
  authorize("admin", "partner"),
  associateDashboard
);

export default router;
