// src/controllers/partnerProfileController.js

import mongoose from "mongoose";
import PartnerProfile from "../models/PartnerProfile.js";
import User from "../models/User.js";

const isValidId = (id) => mongoose.isValidObjectId(id);

/**
 * POST /api/partner-profiles
 */
export const createPartnerProfile = async (req, res) => {
  try {
    const {
      userId: userIdInBody,
      title,
      specialization,
      experienceYears,
      landmarkCases,
      achievements,
      publications
    } = req.body;

    // partner can only create for self; admin can create for anyone
    const targetUserId = req.user.role === "admin" ? (userIdInBody || req.user.id) : req.user.id;

    if (!isValidId(targetUserId)) {
      return res.status(400).json({ error: "Invalid userId" });
    }

    const user = await User.findById(targetUserId);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.role !== "partner" && req.user.role !== "admin") {
      return res.status(400).json({ error: "User is not a partner" });
    }

    const profile = new PartnerProfile({
      userId: targetUserId,
      title,
      specialization,
      experienceYears,
      landmarkCases,
      achievements,
      publications
    });

    await profile.save();
    res.status(201).json({ success: true, profile });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "Partner profile already exists for this user" });
    }
    console.error("createPartnerProfile error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ====== SELF (no params) ======

export const getMyPartnerProfile = async (req, res) => {
  try {
    const profile = await PartnerProfile
      .findOne({ userId: req.user.id })
      .populate("userId", "-passwordHash");
    if (!profile) return res.status(404).json({ error: "Partner profile not found" });
    res.json({ success: true, profile });
  } catch (err) {
    console.error("getMyPartnerProfile error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

export const updateMyPartnerProfile = async (req, res) => {
  try {
    if ("userId" in req.body) {
      return res.status(400).json({ error: "Cannot change userId of a profile" });
    }
    const profile = await PartnerProfile.findOne({ userId: req.user.id });
    if (!profile) return res.status(404).json({ error: "Partner profile not found" });

    Object.assign(profile, req.body);
    const updated = await profile.save();
    res.json({ success: true, profile: updated });
  } catch (err) {
    console.error("updateMyPartnerProfile error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

export const deleteMyPartnerProfile = async (req, res) => {
  try {
    const profile = await PartnerProfile.findOne({ userId: req.user.id });
    if (!profile) return res.status(404).json({ error: "Partner profile not found" });
    await profile.deleteOne();
    res.json({ success: true, message: "Partner profile deleted" });
  } catch (err) {
    console.error("deleteMyPartnerProfile error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ====== ADMIN (no params) ======

export const listPartnerProfiles = async (req, res) => {
  try {
    // optional filters & pagination
    const { userId, specialization, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (userId) filter.userId = userId;
    if (specialization) filter.specialization = specialization;

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      PartnerProfile.find(filter).skip(skip).limit(Number(limit)).populate("userId", "-passwordHash"),
      PartnerProfile.countDocuments(filter)
    ]);

    res.json({
      success: true,
      page: Number(page),
      limit: Number(limit),
      total,
      items
    });
  } catch (err) {
    console.error("listPartnerProfiles error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

export const getPartnerProfileByUser = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId || !isValidId(userId)) return res.status(400).json({ error: "userId query is required and must be valid" });

    const profile = await PartnerProfile.findOne({ userId }).populate("userId", "-passwordHash");
    if (!profile) return res.status(404).json({ error: "Partner profile not found" });
    res.json({ success: true, profile });
  } catch (err) {
    console.error("getPartnerProfileByUser error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

export const getPartnerProfileById = async (req, res) => {
  try {
    const { id } = req.query;
    if (!id || !isValidId(id)) return res.status(400).json({ error: "id query is required and must be valid" });

    const profile = await PartnerProfile.findById(id).populate("userId", "-passwordHash");
    if (!profile) return res.status(404).json({ error: "Partner profile not found" });
    res.json({ success: true, profile });
  } catch (err) {
    console.error("getPartnerProfileById error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

export const updatePartnerProfileById = async (req, res) => {
  try {
    const { id, ...updates } = req.body;
    if (!id || !isValidId(id)) return res.status(400).json({ error: "Body must include a valid id" });
    if ("userId" in updates) {
      return res.status(400).json({ error: "Cannot change userId of a profile" });
    }

    const updated = await PartnerProfile.findByIdAndUpdate(id, updates, { new: true });
    if (!updated) return res.status(404).json({ error: "Partner profile not found" });
    res.json({ success: true, profile: updated });
  } catch (err) {
    console.error("updatePartnerProfileById error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

export const deletePartnerProfileById = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id || !isValidId(id)) return res.status(400).json({ error: "Body must include a valid id" });

    const profile = await PartnerProfile.findById(id);
    if (!profile) return res.status(404).json({ error: "Partner profile not found" });

    await profile.deleteOne();
    res.json({ success: true, message: "Partner profile deleted" });
  } catch (err) {
    console.error("deletePartnerProfileById error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * DASHBOARD
 * GET /api/partner-profiles/dashboard
 */
export const partnerDashboard = async (_req, res) => {
  try {
    const totalPartners = await PartnerProfile.countDocuments();
    res.json({
      success: true,
      cards: {
        totalPartners,
      },
    });
  } catch (err) {
    console.error("partnerDashboard error:", err);
    res.status(500).json({ error: "Unable to load partner dashboard" });
  }
};
