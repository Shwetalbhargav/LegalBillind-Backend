// controllers/internProfileController.js
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
      ...(billingRate !== undefined ? { billingRate } : {}) // schema default is 750
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
    const profiles = await InternProfile.find().populate("userId", "-passwordHash");
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
    const profile = await InternProfile.findById(id).populate("userId", "-passwordHash");
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

    const updated = await InternProfile.findByIdAndUpdate(id, updates, { new: true });
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
