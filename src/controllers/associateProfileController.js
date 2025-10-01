// controllers/associateProfileController.js
import AssociateProfile from "../models/AssociateProfile.js";
import User from "../models/User.js";

// Create
export const createAssociateProfile = async (req, res) => {
  try {
    const { userId, specialization, experienceYears, achievements } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.role !== "associate") return res.status(400).json({ error: "User is not an associate" });

    const profile = new AssociateProfile({ userId, specialization, experienceYears, achievements });
    await profile.save();
    res.status(201).json({ success: true, profile });
  } catch (err) {
    console.error("createAssociateProfile error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// List
export const listAssociateProfiles = async (req, res) => {
  try {
    const profiles = await AssociateProfile.find().populate("userId", "-passwordHash");
    res.json({ success: true, profiles });
  } catch (err) {
    console.error("listAssociateProfiles error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Get
export const getAssociateProfile = async (req, res) => {
  try {
    const profile = await AssociateProfile.findById(req.params.id).populate("userId", "-passwordHash");
    if (!profile) return res.status(404).json({ error: "Associate profile not found" });
    res.json({ success: true, profile });
  } catch (err) {
    console.error("getAssociateProfile error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Update
export const updateAssociateProfile = async (req, res) => {
  try {
    const profile = await AssociateProfile.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!profile) return res.status(404).json({ error: "Associate profile not found" });
    res.json({ success: true, profile });
  } catch (err) {
    console.error("updateAssociateProfile error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Delete
export const deleteAssociateProfile = async (req, res) => {
  try {
    const deleted = await AssociateProfile.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Associate profile not found" });
    res.json({ success: true, message: "Associate profile deleted" });
  } catch (err) {
    console.error("deleteAssociateProfile error:", err);
    res.status(500).json({ error: "Server error" });
  }
};
