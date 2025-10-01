// controllers/partnerProfileController.js
import PartnerProfile from "../models/PartnerProfile.js";
import User from "../models/User.js";

/**
 * Create Partner Profile
 * POST /api/partners
 */
export const createPartnerProfile = async (req, res) => {
  try {
    const { userId, title, specialization, experienceYears, landmarkCases, achievements, publications } = req.body;

    // Ensure user exists and is partner
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.role !== "partner") return res.status(400).json({ error: "User is not a partner" });

    const profile = new PartnerProfile({
      userId,
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
    console.error("createPartnerProfile error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * Get all Partner Profiles
 * GET /api/partners
 */
export const listPartnerProfiles = async (req, res) => {
  try {
    const profiles = await PartnerProfile.find().populate("userId", "-passwordHash");
    res.json({ success: true, profiles });
  } catch (err) {
    console.error("listPartnerProfiles error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * Get a single Partner Profile
 * GET /api/partners/:id
 */
export const getPartnerProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const profile = await PartnerProfile.findById(id).populate("userId", "-passwordHash");
    if (!profile) return res.status(404).json({ error: "Partner profile not found" });
    res.json({ success: true, profile });
  } catch (err) {
    console.error("getPartnerProfile error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * Update Partner Profile
 * PUT /api/partners/:id
 */
export const updatePartnerProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const profile = await PartnerProfile.findByIdAndUpdate(id, updates, { new: true });
    if (!profile) return res.status(404).json({ error: "Partner profile not found" });

    res.json({ success: true, profile });
  } catch (err) {
    console.error("updatePartnerProfile error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * Delete Partner Profile
 * DELETE /api/partners/:id
 */
export const deletePartnerProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await PartnerProfile.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: "Partner profile not found" });

    res.json({ success: true, message: "Partner profile deleted" });
  } catch (err) {
    console.error("deletePartnerProfile error:", err);
    res.status(500).json({ error: "Server error" });
  }
};
