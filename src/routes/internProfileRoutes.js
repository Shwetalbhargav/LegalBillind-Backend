import express from "express";
import {
  createInternProfile,
  listInternProfiles,
  getInternProfile,
  updateInternProfile,
  deleteInternProfile
} from "../controllers/internProfileController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.post("/", authenticate, authorize("admin", "partner"), createInternProfile);
router.get("/", authenticate, authorize("admin", "partner"), listInternProfiles);
router.get("/:id", authenticate, authorize("admin", "partner"), getInternProfile);
router.put("/:id", authenticate, authorize("admin", "partner"), updateInternProfile);
router.delete("/:id", authenticate, authorize("admin", "partner"), deleteInternProfile);

export default router;
