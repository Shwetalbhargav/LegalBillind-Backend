// src/controllers/lawyerProfileController.js

import LawyerProfile from "../models/LawyerProfile.js";
import User from "../models/User.js";
import mongoose from "mongoose";

const isValidId = (id) => mongoose.isValidObjectId(id);

/**
 * ADMIN / SYSTEM CRUD
 */

/**
 * POST /api/lawyer-profiles
 */
export const createLawyerProfile = async (req, res) => {
  try {
    const { userId, specialization, experienceYears, landmarkCases, achievements } = req.body;

    if (!isValidId(userId)) return res.status(400).json({ error: "Invalid userId" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.role !== "lawyer") return res.status(400).json({ error: "User is not a lawyer" });

    const profile = new LawyerProfile({ userId, specialization, experienceYears, landmarkCases, achievements });
    await profile.save();
    res.status(201).json({ success: true, profile });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "Lawyer profile already exists for this user" });
    }
    console.error("createLawyerProfile error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * GET /api/lawyer-profiles
 */
export const listLawyerProfiles = async (_req, res) => {
  try {
    const profiles = await LawyerProfile.find().populate("userId", "-passwordHash");
    res.json({ success: true, profiles });
  } catch (err) {
    console.error("listLawyerProfiles error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * GET /api/lawyer-profiles/by-id?id=
 */
export const getLawyerProfile = async (req, res) => {
  try {
    const { id } = req.query;
    if (!id || !isValidId(id)) return res.status(400).json({ error: "id query param required and valid" });

    const profile = await LawyerProfile.findById(id).populate("userId", "-passwordHash");
    if (!profile) return res.status(404).json({ error: "Lawyer profile not found" });
    res.json({ success: true, profile });
  } catch (err) {
    console.error("getLawyerProfile error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * PATCH /api/lawyer-profiles
 * Body: { id, ...updates }
 */
export const updateLawyerProfile = async (req, res) => {
  try {
    const { id, ...updates } = req.body;
    if (!id || !isValidId(id)) return res.status(400).json({ error: "Body must include a valid id" });

    if ("userId" in updates) return res.status(400).json({ error: "Cannot change userId" });

    const profile = await LawyerProfile.findByIdAndUpdate(id, updates, { new: true });
    if (!profile) return res.status(404).json({ error: "Lawyer profile not found" });
    res.json({ success: true, profile });
  } catch (err) {
    console.error("updateLawyerProfile error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * DELETE /api/lawyer-profiles
 * Body: { id }
 */
export const deleteLawyerProfile = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id || !isValidId(id)) return res.status(400).json({ error: "Body must include a valid id" });

    const deleted = await LawyerProfile.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: "Lawyer profile not found" });
    res.json({ success: true, message: "Lawyer profile deleted" });
  } catch (err) {
    console.error("deleteLawyerProfile error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * ADMIN: GET /api/lawyer-profiles/by-user?userId=
 */
export const getLawyerProfileByUser = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId || !isValidId(userId)) {
      return res.status(400).json({ error: "userId query param required and valid" });
    }

    const profile = await LawyerProfile.findOne({ userId }).populate("userId", "-passwordHash");
    if (!profile) return res.status(404).json({ error: "Lawyer profile not found" });
    res.json({ success: true, profile });
  } catch (err) {
    console.error("getLawyerProfileByUser error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * SELF APIs (for logged-in lawyer)
 */

/**
 * GET /api/lawyer-profiles/me
 */
export const getMyLawyerProfile = async (req, res) => {
  try {
    const me = await User.findById(req.user.id);
    if (!me) return res.status(404).json({ error: "User not found" });
    if (me.role !== "lawyer") return res.status(403).json({ error: "Forbidden" });

    const profile = await LawyerProfile.findOne({ userId: me._id }).populate("userId", "-passwordHash");
    if (!profile) return res.status(404).json({ error: "Lawyer profile not found" });
    res.json({ success: true, profile });
  } catch (err) {
    console.error("getMyLawyerProfile error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * PATCH /api/lawyer-profiles/me
 */
export const updateMyLawyerProfile = async (req, res) => {
  try {
    const me = await User.findById(req.user.id);
    if (!me) return res.status(404).json({ error: "User not found" });
    if (me.role !== "lawyer") return res.status(403).json({ error: "Forbidden" });

    if ("userId" in req.body || "id" in req.body) {
      return res.status(400).json({ error: "Cannot change userId or id of a profile" });
    }

    const profile = await LawyerProfile.findOne({ userId: me._id });
    if (!profile) return res.status(404).json({ error: "Lawyer profile not found" });

    Object.assign(profile, req.body);
    const updated = await profile.save();
    res.json({ success: true, profile: updated });
  } catch (err) {
    console.error("updateMyLawyerProfile error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * DELETE /api/lawyer-profiles/me
 */
export const deleteMyLawyerProfile = async (req, res) => {
  try {
    const me = await User.findById(req.user.id);
    if (!me) return res.status(404).json({ error: "User not found" });
    if (me.role !== "lawyer") return res.status(403).json({ error: "Forbidden" });

    const profile = await LawyerProfile.findOne({ userId: me._id });
    if (!profile) return res.status(404).json({ error: "Lawyer profile not found" });

    await profile.deleteOne();
    res.json({ success: true, message: "Lawyer profile deleted" });
  } catch (err) {
    console.error("deleteMyLawyerProfile error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * DASHBOARD
 * GET /api/lawyer-profiles/dashboard
 */
export const lawyerDashboard = async (_req, res) => {
  try {
    const totalLawyers = await LawyerProfile.countDocuments();
    res.json({
      success: true,
      cards: {
        totalLawyers,
      },
    });
  } catch (err) {
    console.error("lawyerDashboard error:", err);
    res.status(500).json({ error: "Unable to load lawyer dashboard" });
  }
};
