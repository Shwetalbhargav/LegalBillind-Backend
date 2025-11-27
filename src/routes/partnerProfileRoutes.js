// src/routes/partnerProfileRoutes.js

import express from "express";
import {
  createPartnerProfile,
  getMyPartnerProfile,
  updateMyPartnerProfile,
  deleteMyPartnerProfile,
  listPartnerProfiles,          // admin only
  getPartnerProfileByUser,      // admin, via ?userId=
  getPartnerProfileById,        // admin, via ?id=
  updatePartnerProfileById,     // admin, via body { id, ...updates }
  deletePartnerProfileById,    // admin, via body { id }
  partnerDashboard 
} from "../controllers/partnerProfileController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

// Partner self-service (no params)
router.post("/", authenticate, authorize("admin", "partner"), createPartnerProfile);
router.get("/me", authenticate, authorize("admin", "partner"), getMyPartnerProfile);
router.put("/me", authenticate, authorize("admin", "partner"), updateMyPartnerProfile);
// Use POST for delete to avoid proxies stripping DELETE bodies
router.post("/me/delete", authenticate, authorize("admin", "partner"), deleteMyPartnerProfile);

// Admin utilities (no path params)
router.get("/", authenticate, authorize("admin"), listPartnerProfiles);
router.get("/by-user", authenticate, authorize("admin"), getPartnerProfileByUser); // ?userId=
router.get("/by-id", authenticate, authorize("admin"), getPartnerProfileById);     // ?id=
router.put("/update", authenticate, authorize("admin"), updatePartnerProfileById); // body.id
router.post("/remove", authenticate, authorize("admin"), deletePartnerProfileById); // body.id
router.get("/dashboard", authenticate, authorize("admin", "partner"), partnerDashboard);

export default router;
