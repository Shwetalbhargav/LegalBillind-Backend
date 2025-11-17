// src/routes/lawyerProfileRoutes.js

import express from "express";
import {
  createLawyerProfile,
  listLawyerProfiles,
  getLawyerProfile,
  updateLawyerProfile,
  deleteLawyerProfile
} from "../controllers/lawyerProfileController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

// Admin/partner can manage
router.post("/", authenticate, authorize("admin", "partner"), createLawyerProfile);
router.get("/", authenticate, authorize("admin", "partner"), listLawyerProfiles);

// Use query or body, not params
router.get("/view", authenticate, authorize("admin", "partner"), getLawyerProfile);
router.put("/update", authenticate, authorize("admin", "partner"), updateLawyerProfile);
router.post("/remove", authenticate, authorize("admin", "partner"), deleteLawyerProfile);

export default router;
