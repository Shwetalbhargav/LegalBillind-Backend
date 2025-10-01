import express from "express";
import {
  createAssociateProfile,
  listAssociateProfiles,
  getAssociateProfile,
  updateAssociateProfile,
  deleteAssociateProfile
} from "../controllers/associateProfileController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.post("/", authenticate, authorize("admin", "partner"), createAssociateProfile);
router.get("/", authenticate, authorize("admin", "partner"), listAssociateProfiles);
router.get("/:id", authenticate, authorize("admin", "partner"), getAssociateProfile);
router.put("/:id", authenticate, authorize("admin", "partner"), updateAssociateProfile);
router.delete("/:id", authenticate, authorize("admin", "partner"), deleteAssociateProfile);

export default router;
