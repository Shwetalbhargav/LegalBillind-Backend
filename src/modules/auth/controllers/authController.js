//src/controllers/authController.js

import bcrypt from "bcryptjs";
import Firm from "../../firms/models/Firm.js";
import User from "../../users/models/User.js";
import { clearAuthCookie, setAuthCookie, signAuthToken } from "../services/authTokenService.js";

function isDuplicateUserError(err) {
  return err?.code === 11000 && (err?.keyPattern?.name || err?.keyPattern?.mobile);
}

function toSafeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    role: user.role,
    firmId: user.firmId,
    address: user.address,
    qualifications: user.qualifications,
  };
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function resolveFirmId({ firmId, firmName }) {
  if (firmId) return firmId;

  const normalizedFirmName = String(firmName || "").trim();
  if (!normalizedFirmName) return undefined;

  const firm = await Firm.findOne({
    name: { $regex: `^${escapeRegExp(normalizedFirmName)}$`, $options: "i" },
  });

  if (!firm) {
    const error = new Error("Firm not found. Please enter an existing firm name.");
    error.statusCode = 400;
    throw error;
  }

  return firm._id;
}

// LOGIN —  uses name + mobile + password + role
export const loginUser = async (req, res) => {
  
  const { name, mobile, password, role, firmId } = req.body;
  try {
    if (!name || !mobile || !password || !role || !firmId) {
      return res.status(400).json({ error: "Name, mobile, password, role and firm are required" });
    }

    const user = await User.findOne({ name, mobile, role, firmId });
    if (!user) return res.status(400).json({ error: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

    const token = signAuthToken(user);
    setAuthCookie(res, token);

    res.json({
      success: true,
      user: toSafeUser(user),
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

export const logoutUser = (_req, res) => {
  clearAuthCookie(res);
  res.json({ success: true });
};

// REGISTER — all fields of User schema
export const registerUser = async (req, res) => {
  try {
    const { name, email, mobile, address, role, password, firmId, firmName, qualifications } = req.body;

    if (!name || !mobile || !password || !role) {
      return res.status(400).json({ error: "Name, mobile, password and role are required" });
    }

    const existing = await User.findOne({
      $or: [
        { name },
        { mobile },
      ],
    });
    if (existing) return res.status(409).json({ error: "User already exists with this name or mobile" });

    const resolvedFirmId = await resolveFirmId({ firmId, firmName });
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      mobile,
      address,
      role,
      firmId: resolvedFirmId,
      passwordHash,
      qualifications,
    });

    res.status(201).json({
      success: true,
      user: toSafeUser(user),
    });
  } catch (err) {
    if (isDuplicateUserError(err)) {
      return res.status(409).json({ error: "User already exists with this name or mobile" });
    }
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("Register error:", err);
    res.status(500).json({ error: "Server error" });
  }
};
