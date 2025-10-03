// routes/associateProfileRoutes.js
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

// No path params — use query/body instead
router.get("/view", authenticate, authorize("admin", "partner"), getAssociateProfile);   // ?id=
router.put("/update", authenticate, authorize("admin", "partner"), updateAssociateProfile); // body.id
router.post("/remove", authenticate, authorize("admin", "partner"), deleteAssociateProfile); // body.id

export default router;
