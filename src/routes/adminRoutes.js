import express from "express";
import {
  adminLogin,
  adminRegister,
  adminGetMe,
  adminUpdateMe,
  adminDashboard,
  createAdmin,
  listAdmins,
  getAdmin,
  updateAdmin,
  deleteAdmin,
} from "../controllers/adminController.js";
import { protect, adminOnly } from "../middleware/auth.js";

const router = express.Router();

/** Auth-style endpoints for Admins */
router.post("/login", adminLogin);            // name+mobile+password (role enforced = admin)
router.post("/register", adminRegister);      // create User(admin) + Admin profile

/** Self-service */
router.patch("/me", protect, adminOnly, adminUpdateMe);
// (Optional but handy) expose GET /me if you want:
router.get("/me", protect, adminOnly, adminGetMe);

/** Dashboard */
router.get("/dashboard", protect, adminOnly, adminDashboard);

/** CRUD over Admin profiles (managed by admins) */
router.post("/",    protect, adminOnly, createAdmin);
router.get("/",     protect, adminOnly, listAdmins);
router.get("/:id",  protect, adminOnly, getAdmin);
router.patch("/:id",protect, adminOnly, updateAdmin);
router.delete("/:id",protect, adminOnly, deleteAdmin);

export default router;
