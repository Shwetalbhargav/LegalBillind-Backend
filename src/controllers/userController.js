import bcrypt from "bcryptjs";
import User from "../models/User.js";

/**
 * POST /api/users
 * Create a new user
 */
export const createUser = async (req, res) => {
  try {
    const { name, email, role, firmId, password, mobile, address, qualifications } = req.body;

    // Basic validation
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required" });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email,
      role,
      firmId,
      passwordHash,
      mobile,
      address,
      qualifications,
    });

    await user.save();

    // Don't return hash
    const userObj = user.toObject();
    delete userObj.passwordHash;

    res.status(201).json({ success: true, user: userObj });
  } catch (err) {
    console.error("createUser error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * PUT /api/users/:id
 * Update an existing user
 */
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    if (updates.password) {
      updates.passwordHash = await bcrypt.hash(updates.password, 10);
      delete updates.password;
    }

    const user = await User.findByIdAndUpdate(id, updates, { new: true, select: "-passwordHash" });
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({ success: true, user });
  } catch (err) {
    console.error("updateUser error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * DELETE /api/users/:id
 * Delete a user
 */
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await User.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: "User not found" });
    res.json({ success: true, message: "User deleted" });
  } catch (err) {
    console.error("deleteUser error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * GET /api/users
 */
export const listUsers = async (req, res) => {
  try {
    const {
      role,
      q,
      firmId,
      page = 1,
      limit = 20,
      sort = "name",
    } = req.query;

    const filter = {};
    if (role) filter.role = role;
    if (firmId) filter.firmId = firmId;
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { mobile: { $regex: q, $options: "i" } },
        { address: { $regex: q, $options: "i" } },
      ];
    }

    const projection = { passwordHash: 0 };
    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      User.find(filter, projection).sort(sort).skip(skip).limit(Number(limit)),
      User.countDocuments(filter),
    ]);

    res.json({
      success: true,
      page: Number(page),
      limit: Number(limit),
      total,
      items,
    });
  } catch (err) {
    console.error("listUsers error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * GET /api/users/me
 */
export const getMe = async (req, res) => {
  try {
    const me = await User.findById(req.user.id, { passwordHash: 0 });
    if (!me) return res.status(404).json({ error: "User not found" });
    res.json({ success: true, user: me });
  } catch (err) {
    console.error("getMe error:", err);
    res.status(500).json({ error: "Server error" });
  }
};
