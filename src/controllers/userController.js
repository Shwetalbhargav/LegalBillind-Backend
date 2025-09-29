// controllers/userController.js
import User from "../models/User.js";

/**
 * GET /api/users
 * Query params:
 *  - role: string (e.g. 'partner','lawyer','associate','intern','admin')
 *  - q: string (free-text search on name/email)
 *  - firmId: string (optional, limit to firm)
 *  - page: number (default 1)
 *  - limit: number (default 20)
 *  - sort: string (e.g. 'name', '-name', 'email', '-createdAt')
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
        { email: { $regex: q, $options: "i" } },
      ];
    }

    // Never return passwordHash
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
 * GET /api/users/me  — return current user profile
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
