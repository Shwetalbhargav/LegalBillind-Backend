// controllers/internProfileController.js
import InternProfile from "../models/InternProfile.js";
import User from "../models/User.js";

export const createInternProfile = async (req, res) => {
  try {
    const { userId, lawSchool, graduationYear, mentor, internshipFocus } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.role !== "intern") return res.status(400).json({ error: "User is not an intern" });

    const profile = new InternProfile({ userId, lawSchool, graduationYear, mentor, internshipFocus });
    await profile.save();
    res.status(201).json({ success: true, profile });
  } catch (err) {
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

export const getInternProfile = async (req, res) => {
  try {
    const profile = await InternProfile.findById(req.params.id).populate("userId", "-passwordHash");
    if (!profile) return res.status(404).json({ error: "Intern profile not found" });
    res.json({ success: true, profile });
  } catch (err) {
    console.error("getInternProfile error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

export const updateInternProfile = async (req, res) => {
  try {
    const profile = await InternProfile.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!profile) return res.status(404).json({ error: "Intern profile not found" });
    res.json({ success: true, profile });
  } catch (err) {
    console.error("updateInternProfile error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

export const deleteInternProfile = async (req, res) => {
  try {
    const deleted = await InternProfile.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Intern profile not found" });
    res.json({ success: true, message: "Intern profile deleted" });
  } catch (err) {
    console.error("deleteInternProfile error:", err);
    res.status(500).json({ error: "Server error" });
  }
};
