// routes/internProfileRoutes.js
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

// No path params — Render-safe endpoints:
router.get("/view", authenticate, authorize("admin", "partner"), getInternProfile);      // ?id=
router.put("/update", authenticate, authorize("admin", "partner"), updateInternProfile); // body.id
router.post("/remove", authenticate, authorize("admin", "partner"), deleteInternProfile); // body.id

export default router;
