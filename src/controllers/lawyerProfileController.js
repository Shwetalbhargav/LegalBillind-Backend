// controllers/lawyerProfileController.js
import LawyerProfile from "../models/LawyerProfile.js";
import User from "../models/User.js";

export const createLawyerProfile = async (req, res) => {
  try {
    const { userId, specialization, experienceYears, landmarkCases, achievements } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.role !== "lawyer") return res.status(400).json({ error: "User is not a lawyer" });

    const profile = new LawyerProfile({ userId, specialization, experienceYears, landmarkCases, achievements });
    await profile.save();
    res.status(201).json({ success: true, profile });
  } catch (err) {
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

export const getLawyerProfile = async (req, res) => {
  try {
    const profile = await LawyerProfile.findById(req.params.id).populate("userId", "-passwordHash");
    if (!profile) return res.status(404).json({ error: "Lawyer profile not found" });
    res.json({ success: true, profile });
  } catch (err) {
    console.error("getLawyerProfile error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

export const updateLawyerProfile = async (req, res) => {
  try {
    const profile = await LawyerProfile.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!profile) return res.status(404).json({ error: "Lawyer profile not found" });
    res.json({ success: true, profile });
  } catch (err) {
    console.error("updateLawyerProfile error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

export const deleteLawyerProfile = async (req, res) => {
  try {
    const deleted = await LawyerProfile.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Lawyer profile not found" });
    res.json({ success: true, message: "Lawyer profile deleted" });
  } catch (err) {
    console.error("deleteLawyerProfile error:", err);
    res.status(500).json({ error: "Server error" });
  }
};
