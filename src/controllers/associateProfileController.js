// controllers/associateProfileController.js
import AssociateProfile from "../models/AssociateProfile.js";
import User from "../models/User.js";
import mongoose from "mongoose";

const isValidId = (id) => mongoose.isValidObjectId(id);

// Create (unchanged, but validates role and handles duplicate)
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

// List (unchanged; optional: add filters/pagination later)
export const listAssociateProfiles = async (req, res) => {
  try {
    const profiles = await AssociateProfile.find().populate("userId", "-passwordHash");
    res.json({ success: true, profiles });
  } catch (err) {
    console.error("listAssociateProfiles error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Get by query ?id= (no path params)
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

// Update by body.id (disallow changing userId)
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

// Delete by body.id
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
