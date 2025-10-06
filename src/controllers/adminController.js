// controllers/adminController.js
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Admin from "../models/admin.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

function signToken(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function toSafeAdmin(adminDoc) {
  const {
    _id,
    name,
    email,
    role,
    firmId,
    mobile,
    address,
    qualifications,
    createdAt,
    updatedAt,
  } = adminDoc;
  return {
    id: _id,
    name,
    email,
    role,
    firmId,
    mobile,
    address,
    qualifications,
    createdAt,
    updatedAt,
  };
}

/**
 * POST /api/admin/register
 */
export const registerAdmin = async (req, res) => {
  try {
    const { name, email, password, mobile, address, qualifications, firmId } =
      req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "name, email, and password are required" });
    }

    const existing = await Admin.findOne({ email });
    if (existing) {
      return res
        .status(409)
        .json({ message: "Admin with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const admin = await Admin.create({
      name,
      email,
      role: "admin",
      firmId: firmId || undefined,
      passwordHash,
      mobile,
      address,
      qualifications,
    });

    const token = signToken(admin);

    // Optionally set an httpOnly cookie (keeps header flow working too)
    if (process.env.SET_AUTH_COOKIE === "true") {
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });
    }

    return res.status(201).json({ token, admin: toSafeAdmin(admin) });
  } catch (err) {
    console.error("registerAdmin error", err);
    return res.status(500).json({ message: "Unable to register admin" });
  }
};

/**
 * POST /api/admin/login
 */
export const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "email and password are required" });
    }

    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = signToken(admin);

    if (process.env.SET_AUTH_COOKIE === "true") {
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }

    return res.status(200).json({ token, admin: toSafeAdmin(admin) });
  } catch (err) {
    console.error("loginAdmin error", err);
    return res.status(500).json({ message: "Unable to login" });
  }
};

/**
 * GET /api/admin/me
 * Requires authentication & (in routes below) admin role.
 */
export const getMe = async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id);
    if (!admin) return res.status(404).json({ message: "Admin not found" });
    return res.json({ admin: toSafeAdmin(admin) });
  } catch (err) {
    console.error("getMe error", err);
    return res.status(500).json({ message: "Unable to fetch profile" });
  }
};

/**
 * PATCH /api/admin/me
 */
export const updateMe = async (req, res) => {
  try {
    const allowed = ["name", "mobile", "address", "qualifications", "firmId"];
    const updates = {};
    for (const key of allowed) if (key in req.body) updates[key] = req.body[key];

    if (req.body.password) {
      updates.passwordHash = await bcrypt.hash(req.body.password, 12);
    }

    const admin = await Admin.findByIdAndUpdate(req.user.id, updates, {
      new: true,
    });
    if (!admin) return res.status(404).json({ message: "Admin not found" });
    return res.json({ admin: toSafeAdmin(admin) });
  } catch (err) {
    console.error("updateMe error", err);
    return res.status(500).json({ message: "Unable to update profile" });
  }
};

/**
 * GET /api/admin/dashboard
 * Placeholder stats; replace with real metrics later.
 */
export const getDashboard = async (_req, res) => {
  try {
    const totalAdmins = await Admin.countDocuments();
    return res.json({
      stats: {
        totalAdmins,
        serverTime: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("getDashboard error", err);
    return res.status(500).json({ message: "Unable to fetch dashboard" });
  }
};
