import bcrypt from "bcryptjs";
import Firm from "../../firms/models/Firm.js";
import User from "../../users/models/User.js";
import { toSafeUser } from "../../users/utils/safeUser.js";
import {
  clearAuthCookie,
  getExtensionJwtExpiresIn,
  setAuthCookie,
  signAuthToken,
  signExtensionToken,
} from "../services/authTokenService.js";

function isDuplicateUserError(err) {
  return err?.code === 11000 && (err?.keyPattern?.name || err?.keyPattern?.mobile);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeMobile(value) {
  return String(value || "").replace(/\D/g, "");
}

async function resolveFirmId({ firmId, firmName }) {
  if (firmId) {
    const firmExists = await Firm.exists({ _id: firmId });
    if (!firmExists) {
      const error = new Error("Firm not found. Please choose an existing firm.");
      error.statusCode = 400;
      throw error;
    }
    return firmId;
  }

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

// Login uses name + mobile + password + role + firm.
export const loginUser = async (req, res) => {
  const { name, mobile, password, role, firmId } = req.body;

  try {
    if (!name || !mobile || !password || !role || !firmId) {
      return res.status(400).json({ error: "Name, mobile, password, role and firm are required" });
    }

    const normalizedMobile = normalizeMobile(mobile);
    const normalizedRole = String(role || "").toLowerCase();
    const user = await User.findOne({ mobile: normalizedMobile, role: normalizedRole, firmId });
    if (!user || normalizeName(user.name) !== normalizeName(name)) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

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

// Stable "who am I" endpoint for frontend refresh/session bootstrap.
export const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      clearAuthCookie(res);
      return res.status(401).json({ success: false, error: "Session user not found" });
    }

    res.json({
      success: true,
      user: toSafeUser(user),
    });
  } catch (err) {
    console.error("Current user error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// Short-lived token for Chrome extension calls.
export const issueExtensionToken = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    const token = signExtensionToken(user);
    res.json({
      success: true,
      token,
      tokenType: "Bearer",
      expiresIn: getExtensionJwtExpiresIn(),
      user: toSafeUser(user),
      extension: req.extensionContext || null,
    });
  } catch (err) {
    console.error("Extension token error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// Register all fields needed by the User schema and shared profile fields.
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
