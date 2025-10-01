// routes/partnerProfileRoutes.js
import express from "express";
import {
  createPartnerProfile,
  listPartnerProfiles,
  getPartnerProfile,
  updatePartnerProfile,
  deletePartnerProfile
} from "../controllers/partnerProfileController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

// Only authenticated users, and usually admin/partners, can manage partner profiles
router.post("/", authenticate, authorize("admin", "partner"), createPartnerProfile);
router.get("/", authenticate, authorize("admin", "partner"), listPartnerProfiles);
router.get("/:id", authenticate, authorize("admin", "partner"), getPartnerProfile);
router.put("/:id", authenticate, authorize("admin", "partner"), updatePartnerProfile);
router.delete("/:id", authenticate, authorize("admin", "partner"), deletePartnerProfile);

export default router;
