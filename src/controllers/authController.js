//src/controllers/authController.js

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

// LOGIN —  uses name + mobile + password + role
export const loginUser = async (req, res) => {
  const { name, mobile, password, role } = req.body;
  try {
    if (!name || !mobile || !password || !role) {
      return res.status(400).json({ error: "Name, mobile, password and role are required" });
    }

    const user = await User.findOne({ name, mobile, role });
    if (!user) return res.status(400).json({ error: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || "supersecretkey",
      { expiresIn: "1d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        mobile: user.mobile,
        role: user.role,
        address: user.address,
        qualifications: user.qualifications,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// REGISTER — all fields of User schema
export const registerUser = async (req, res) => {
  try {
    const { name, email, mobile, address, role, password, firmId, qualifications } = req.body;

    if (!name || !mobile || !password || !role) {
      return res.status(400).json({ error: "Name, mobile, password and role are required" });
    }

    const existing = await User.findOne({ name, mobile, role });
    if (existing) return res.status(400).json({ error: "User already exists with this name and mobile" });

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      mobile,
      address,
      role,
      firmId,
      passwordHash,
      qualifications,
    });

    res.status(201).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        mobile: user.mobile,
        role: user.role,
        address: user.address,
        qualifications: user.qualifications,
      },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Server error" });
  }
};
