// src/controllers/internProfileController.js

import InternProfile from "../models/InternProfile.js";
import User from "../models/User.js";
import mongoose from "mongoose";

const isValidId = (id) => mongoose.isValidObjectId(id);

export const createInternProfile = async (req, res) => {
  try {
    const { userId, lawSchool, graduationYear, mentor, internshipFocus, billingRate } = req.body;

    if (!isValidId(userId)) return res.status(400).json({ error: "Invalid userId" });
    if (mentor && !isValidId(mentor)) return res.status(400).json({ error: "Invalid mentor id" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.role !== "intern") return res.status(400).json({ error: "User is not an intern" });

    const profile = new InternProfile({
      userId,
      lawSchool,
      graduationYear,
      mentor,
      internshipFocus,
      ...(billingRate !== undefined ? { billingRate } : {}), // schema default is 750
    });

    await profile.save();
    res.status(201).json({ success: true, profile });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "Intern profile already exists for this user" });
    }
    console.error("createInternProfile error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

export const listInternProfiles = async (req, res) => {
  try {
    const profiles = await InternProfile.find()
      .populate("userId", "-passwordHash")
      .populate("mentor", "firstName lastName email role");
    res.json({ success: true, profiles });
  } catch (err) {
    console.error("listInternProfiles error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// GET via query ?id= (no path params)
export const getInternProfile = async (req, res) => {
  try {
    const { id } = req.query;
    if (!id || !isValidId(id)) {
      return res.status(400).json({ error: "id query param is required and must be valid" });
    }
    const profile = await InternProfile.findById(id)
      .populate("userId", "-passwordHash")
      .populate("mentor", "firstName lastName email role");
    if (!profile) return res.status(404).json({ error: "Intern profile not found" });
    res.json({ success: true, profile });
  } catch (err) {
    console.error("getInternProfile error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// PUT via body.id (disallow changing userId)
export const updateInternProfile = async (req, res) => {
  try {
    const { id, ...updates } = req.body;
    if (!id || !isValidId(id)) {
      return res.status(400).json({ error: "Body must include a valid id" });
    }
    if ("userId" in updates) {
      return res.status(400).json({ error: "Cannot change userId of a profile" });
    }
    if ("mentor" in updates && updates.mentor && !isValidId(updates.mentor)) {
      return res.status(400).json({ error: "Invalid mentor id" });
    }

    const updated = await InternProfile.findByIdAndUpdate(id, updates, {
      new: true,
    })
      .populate("userId", "-passwordHash")
      .populate("mentor", "firstName lastName email role");

    if (!updated) return res.status(404).json({ error: "Intern profile not found" });
    res.json({ success: true, profile: updated });
  } catch (err) {
    console.error("updateInternProfile error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// DELETE via body.id
export const deleteInternProfile = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id || !isValidId(id)) {
      return res.status(400).json({ error: "Body must include a valid id" });
    }
    const deleted = await InternProfile.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: "Intern profile not found" });
    res.json({ success: true, message: "Intern profile deleted" });
  } catch (err) {
    console.error("deleteInternProfile error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * NEW: admin/partner get by userId (?userId=...)
 * Route: GET /api/intern-profiles/by-user
 */
export const getInternProfileByUser = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId || !isValidId(userId)) {
      return res.status(400).json({ error: "userId query param is required and must be valid" });
    }

    const profile = await InternProfile.findOne({ userId })
      .populate("userId", "-passwordHash")
      .populate("mentor", "firstName lastName email role");

    if (!profile) {
      return res.status(404).json({ error: "Intern profile not found for this user" });
    }

    res.json({ success: true, profile });
  } catch (err) {
    console.error("getInternProfileByUser error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * SELF APIs (for logged-in intern)
 * Routes:
 *   GET    /api/intern-profiles/me
 *   PATCH  /api/intern-profiles/me
 *   DELETE /api/intern-profiles/me
 */

const getAuthUserId = (req) => req.user?.id || req.user?._id?.toString?.();

/**
 * GET /me - Logged-in intern's own profile
 */
export const getMyInternProfile = async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId || !isValidId(userId)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (req.user?.role && req.user.role !== "intern") {
      return res.status(403).json({ error: "Only interns can access this endpoint" });
    }

    const profile = await InternProfile.findOne({ userId })
      .populate("userId", "-passwordHash")
      .populate("mentor", "firstName lastName email role");

    if (!profile) {
      return res.status(404).json({ error: "Intern profile not found" });
    }

    res.json({ success: true, profile });
  } catch (err) {
    console.error("getMyInternProfile error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * PATCH /me - Update logged-in intern's own profile
 */
export const updateMyInternProfile = async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId || !isValidId(userId)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (req.user?.role && req.user.role !== "intern") {
      return res.status(403).json({ error: "Only interns can update this profile" });
    }

    const updates = { ...req.body };
    // Prevent changing ownership
    delete updates.userId;

    if ("mentor" in updates && updates.mentor && !isValidId(updates.mentor)) {
      return res.status(400).json({ error: "Invalid mentor id" });
    }

    const updated = await InternProfile.findOneAndUpdate(
      { userId },
      updates,
      { new: true }
    )
      .populate("userId", "-passwordHash")
      .populate("mentor", "firstName lastName email role");

    if (!updated) {
      return res.status(404).json({ error: "Intern profile not found" });
    }

    res.json({ success: true, profile: updated });
  } catch (err) {
    console.error("updateMyInternProfile error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * DELETE /me - Delete logged-in intern's own profile
 */
export const deleteMyInternProfile = async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId || !isValidId(userId)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (req.user?.role && req.user.role !== "intern") {
      return res.status(403).json({ error: "Only interns can delete this profile" });
    }

    const deleted = await InternProfile.findOneAndDelete({ userId });
    if (!deleted) {
      return res.status(404).json({ error: "Intern profile not found" });
    }

    res.json({ success: true, message: "Intern profile deleted" });
  } catch (err) {
    console.error("deleteMyInternProfile error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * DASHBOARD - high-level overview for admins/partners
 * Route: GET /api/intern-profiles/dashboard
 */
export const internDashboard = async (req, res) => {
  try {
    const profiles = await InternProfile.find()
      .populate("userId", "-passwordHash")
      .populate("mentor", "firstName lastName email role");

    const totalInterns = profiles.length;
    const withMentor = profiles.filter((p) => p.mentor).length;
    const withoutMentor = totalInterns - withMentor;

    const totalRate = profiles.reduce(
      (sum, p) => sum + (typeof p.billingRate === "number" ? p.billingRate : 0),
      0
    );
    const avgBillingRate = totalInterns > 0 ? totalRate / totalInterns : 0;

    const stats = {
      totalInterns,
      withMentor,
      withoutMentor,
      avgBillingRate,
    };

    res.json({ success: true, stats, profiles });
  } catch (err) {
    console.error("internDashboard error:", err);
    res.status(500).json({ error: "Server error" });
  }
};
