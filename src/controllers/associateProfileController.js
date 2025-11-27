// src/controllers/associateProfileController.js

import AssociateProfile from "../models/AssociateProfile.js";
import User from "../models/User.js";
import mongoose from "mongoose";

const isValidId = (id) => mongoose.isValidObjectId(id);

/**
 * ADMIN / SYSTEM CRUD
 */

/**
 * POST /api/associate-profiles
 * Body: { userId, specialization, experienceYears, achievements, billingRate? }
 */
export const createAssociateProfile = async (req, res) => {
  try {
    const { userId, specialization, experienceYears, achievements, billingRate } = req.body;

    if (!isValidId(userId)) return res.status(400).json({ error: "Invalid userId" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.role !== "associate") return res.status(400).json({ error: "User is not an associate" });

    const profile = new AssociateProfile({
      userId,
      specialization,
      experienceYears,
      achievements,
      ...(billingRate !== undefined ? { billingRate } : {})
    });

    await profile.save();
    res.status(201).json({ success: true, profile });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "Associate profile already exists for this user" });
    }
    console.error("createAssociateProfile error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * GET /api/associate-profiles
 * Optional: later add filters / pagination
 */
export const listAssociateProfiles = async (_req, res) => {
  try {
    const profiles = await AssociateProfile.find().populate("userId", "-passwordHash");
    res.json({ success: true, profiles });
  } catch (err) {
    console.error("listAssociateProfiles error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * GET /api/associate-profiles/by-id?id=
 * (kept compatible with existing getAssociateProfile)
 */
export const getAssociateProfile = async (req, res) => {
  try {
    const { id } = req.query;
    if (!id || !isValidId(id)) {
      return res.status(400).json({ error: "id query param is required and must be valid" });
    }
    const profile = await AssociateProfile.findById(id).populate("userId", "-passwordHash");
    if (!profile) return res.status(404).json({ error: "Associate profile not found" });
    res.json({ success: true, profile });
  } catch (err) {
    console.error("getAssociateProfile error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * PATCH /api/associate-profiles
 * Body: { id, ...updates } (no userId change)
 */
export const updateAssociateProfile = async (req, res) => {
  try {
    const { id, ...updates } = req.body;
    if (!id || !isValidId(id)) {
      return res.status(400).json({ error: "Body must include a valid id" });
    }
    if ("userId" in updates) {
      return res.status(400).json({ error: "Cannot change userId of a profile" });
    }
    const updated = await AssociateProfile.findByIdAndUpdate(id, updates, { new: true });
    if (!updated) return res.status(404).json({ error: "Associate profile not found" });
    res.json({ success: true, profile: updated });
  } catch (err) {
    console.error("updateAssociateProfile error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * DELETE /api/associate-profiles
 * Body: { id }
 */
export const deleteAssociateProfile = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id || !isValidId(id)) {
      return res.status(400).json({ error: "Body must include a valid id" });
    }
    const deleted = await AssociateProfile.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: "Associate profile not found" });
    res.json({ success: true, message: "Associate profile deleted" });
  } catch (err) {
    console.error("deleteAssociateProfile error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * ADMIN: GET /api/associate-profiles/by-user?userId=
 * Lookup by underlying user
 */
export const getAssociateProfileByUser = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId || !isValidId(userId)) {
      return res.status(400).json({ error: "userId query param is required and must be valid" });
    }
    const profile = await AssociateProfile.findOne({ userId }).populate("userId", "-passwordHash");
    if (!profile) return res.status(404).json({ error: "Associate profile not found" });
    res.json({ success: true, profile });
  } catch (err) {
    console.error("getAssociateProfileByUser error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * SELF APIs (for logged-in associate)
 */

/**
 * GET /api/associate-profiles/me
 */
export const getMyAssociateProfile = async (req, res) => {
  try {
    const me = await User.findById(req.user.id);
    if (!me) return res.status(404).json({ error: "User not found" });
    if (me.role !== "associate") return res.status(403).json({ error: "Forbidden" });

    const profile = await AssociateProfile.findOne({ userId: me._id }).populate("userId", "-passwordHash");
    if (!profile) return res.status(404).json({ error: "Associate profile not found" });
    res.json({ success: true, profile });
  } catch (err) {
    console.error("getMyAssociateProfile error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * PATCH /api/associate-profiles/me
 * Body: { ...updates } (no userId/id)
 */
export const updateMyAssociateProfile = async (req, res) => {
  try {
    const me = await User.findById(req.user.id);
    if (!me) return res.status(404).json({ error: "User not found" });
    if (me.role !== "associate") return res.status(403).json({ error: "Forbidden" });

    if ("userId" in req.body || "id" in req.body) {
      return res.status(400).json({ error: "Cannot change userId or id of a profile" });
    }

    const profile = await AssociateProfile.findOne({ userId: me._id });
    if (!profile) return res.status(404).json({ error: "Associate profile not found" });

    Object.assign(profile, req.body);
    const updated = await profile.save();
    res.json({ success: true, profile: updated });
  } catch (err) {
    console.error("updateMyAssociateProfile error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * DELETE /api/associate-profiles/me
 */
export const deleteMyAssociateProfile = async (req, res) => {
  try {
    const me = await User.findById(req.user.id);
    if (!me) return res.status(404).json({ error: "User not found" });
    if (me.role !== "associate") return res.status(403).json({ error: "Forbidden" });

    const profile = await AssociateProfile.findOne({ userId: me._id });
    if (!profile) return res.status(404).json({ error: "Associate profile not found" });

    await profile.deleteOne();
    res.json({ success: true, message: "Associate profile deleted" });
  } catch (err) {
    console.error("deleteMyAssociateProfile error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * DASHBOARD
 * GET /api/associate-profiles/dashboard
 * Simple KPIs similar to adminDashboard
 */
export const associateDashboard = async (_req, res) => {
  try {
    const totalAssociates = await AssociateProfile.countDocuments();
    res.json({
      success: true,
      cards: {
        totalAssociates,
      },
    });
  } catch (err) {
    console.error("associateDashboard error:", err);
    res.status(500).json({ error: "Unable to load associate dashboard" });
  }
};
