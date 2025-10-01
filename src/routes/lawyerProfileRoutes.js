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

router.post("/", authenticate, authorize("admin", "partner"), createLawyerProfile);
router.get("/", authenticate, authorize("admin", "partner"), listLawyerProfiles);
router.get("/:id", authenticate, authorize("admin", "partner"), getLawyerProfile);
router.put("/:id", authenticate, authorize("admin", "partner"), updateLawyerProfile);
router.delete("/:id", authenticate, authorize("admin", "partner"), deleteLawyerProfile);

export default router;
