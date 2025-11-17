//src/controllers/lawyerProfileController.js

import LawyerProfile from "../models/LawyerProfile.js";
import User from "../models/User.js";
import mongoose from "mongoose";

const isValidId = (id) => mongoose.isValidObjectId(id);

export const createLawyerProfile = async (req, res) => {
  try {
    const { userId, specialization, experienceYears, landmarkCases, achievements } = req.body;

    // Only admin/partner can create, so req.user is trusted. You may also check role explicitly.
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

export const listLawyerProfiles = async (req, res) => {
  try {
    const profiles = await LawyerProfile.find().populate("userId", "-passwordHash");
    res.json({ success: true, profiles });
  } catch (err) {
    console.error("listLawyerProfiles error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Get by query ?id=
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

// Update by body.id
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

// Delete by body.id
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
