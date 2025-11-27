// routes/internProfileRoutes.js
import express from "express";
import {
  createInternProfile,
  listInternProfiles,
  getInternProfile,
  updateInternProfile,
  deleteInternProfile,
  getInternProfileByUser,
  getMyInternProfile,
  updateMyInternProfile,
  deleteMyInternProfile,
  internDashboard,
} from "../controllers/internProfileController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.post("/", authenticate, authorize("admin", "partner"), createInternProfile);
router.get("/",  authenticate, authorize("admin", "partner"), listInternProfiles);

// No path params — Render-safe endpoints:
router.get("/view",    authenticate, authorize("admin", "partner"), getInternProfile);
router.put("/update",  authenticate, authorize("admin", "partner"), updateInternProfile);
router.post("/remove", authenticate, authorize("admin", "partner"), deleteInternProfile);

// NEW: admin get by userId (?userId=...)
router.get("/by-user", authenticate, authorize("admin", "partner"), getInternProfileByUser);

/**
 * SELF APIs (for logged-in intern)
 */
router.get("/me",    authenticate, getMyInternProfile);
router.patch("/me",  authenticate, updateMyInternProfile);
router.delete("/me", authenticate, deleteMyInternProfile);

/**
 * DASHBOARD
 */
router.get(
  "/dashboard",
  authenticate,
  authorize("admin", "partner"),
  internDashboard
);

export default router;
