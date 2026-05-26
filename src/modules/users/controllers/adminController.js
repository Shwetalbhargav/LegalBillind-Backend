//src/controllers/adminController.js

import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Admin from "../models/admin.js";
import Firm from "../../firms/models/Firm.js";
import { clearAuthCookie, setAuthCookie, signAuthToken } from "../../auth/services/authTokenService.js";
import { toSafeUser } from "../utils/safeUser.js";

function normName(s) { return (s || "").trim().replace(/\s+/g, " ").toLowerCase(); }

function roleMeta(name) {
  const displayName = name || "there";
  return { welcomeMessage: `Welcome Admin ${displayName}!`, dashboardPath: "/admin/dashboard" };
}

async function firmExists(firmId) {
  if (!firmId) return false;
  return Boolean(await Firm.exists({ _id: firmId }));
}

function toSafeAdminProfile(a) {
  if (!a) return null;
  const { _id, userId, name, email, mobile, address, qualifications, firmId, createdAt, updatedAt } = a;
  return { id: _id, userId, name, email, mobile, address, qualifications, firmId, createdAt, updatedAt };
}

/** POST /api/admin/login
 * Body: { name, mobile, password }
 * - Requires all 3
 * - User.role must be "admin"
 */
export const adminLogin = async (req, res) => {
  try {
    const { name, mobile, password, firmId } = req.body || {};
    if (!name || !mobile || !password || !firmId) return res.status(400).json({ message: "name, mobile, password and firm are required" });

    const user = await User.findOne({ mobile, role: "admin", firmId });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    if (normName(user.name) !== normName(name)) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash || "");
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = signAuthToken(user);
    setAuthCookie(res, token);

    const profile = await Admin.findOne({ userId: user._id });
    const meta = roleMeta(user.name);
    return res.status(200).json({
      user: toSafeUser(user),
      profile: toSafeAdminProfile(profile),
      ...meta,
    });
  } catch (e) {
    console.error("adminLogin error", e);
    return res.status(500).json({ message: "Unable to login" });
  }
};

/** POST /api/admin/register
 * Body: { name, mobile, password, email?, firmId?, address?, qualifications?[] }
 * - Creates User (role=admin) + Admin profile (userId)
 */
export const adminRegister = async (req, res) => {
  try {
    const { name, mobile, password, email, firmId, address, qualifications } = req.body || {};
    if (!name || !mobile || !password || !firmId) return res.status(400).json({ message: "name, mobile, password and firm are required" });
    if (!(await firmExists(firmId))) return res.status(400).json({ message: "Firm not found. Please choose an existing firm." });

    const exists = await User.findOne({ mobile });
    if (exists) return res.status(409).json({ message: "Mobile already registered" });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, mobile, email, firmId, role: "admin", passwordHash });
    const admin = await Admin.create({ userId: user._id, name, mobile, email, address, qualifications, firmId });

    const token = signAuthToken(user);
    setAuthCookie(res, token);
    const meta = roleMeta(user.name);
    return res.status(201).json({
      user: toSafeUser(user),
      profile: toSafeAdminProfile(admin),
      ...meta,
    });
  } catch (e) {
    console.error("adminRegister error", e);
    return res.status(500).json({ message: "Unable to register admin" });
  }
};

export const adminLogout = (_req, res) => {
  clearAuthCookie(res);
  return res.json({ success: true });
};

/** GET /api/admin/me (optional) */
export const adminGetMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const profile = await Admin.findOne({ userId: user._id });
    const meta = roleMeta(user.name);
    return res.json({ user: toSafeUser(user), profile: toSafeAdminProfile(profile), ...meta });
  } catch (e) {
    console.error("adminGetMe error", e);
    return res.status(500).json({ message: "Unable to load profile" });
  }
};

/** PATCH /api/admin/me */
export const adminUpdateMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });

    // Update allowed user fields
    const uAllowed = ["name", "email", "mobile", "firmId"];
    const uSet = {};
    for (const k of uAllowed) if (k in req.body) uSet[k] = req.body[k];
    if (req.body.password) uSet.passwordHash = await bcrypt.hash(req.body.password, 12);

    if (Object.keys(uSet).length) await User.findByIdAndUpdate(user._id, uSet, { new: false });

    // Update admin profile fields
    const aAllowed = ["name", "email", "mobile", "address", "qualifications", "firmId"];
    const aSet = {};
    for (const k of aAllowed) if (k in req.body) aSet[k] = req.body[k];
    const profile = await Admin.findOneAndUpdate(
      { userId: user._id },
      { $set: aSet },
      { new: true, upsert: true }
    );

    const freshUser = await User.findById(user._id);
    const meta = roleMeta(freshUser.name);
    return res.json({ user: toSafeUser(freshUser), profile: toSafeAdminProfile(profile), ...meta });
  } catch (e) {
    console.error("adminUpdateMe error", e);
    return res.status(500).json({ message: "Unable to update profile" });
  }
};

/** GET /api/admin/dashboard */
export const adminDashboard = async (_req, res) => {
  try {
    // Stub numbers (replace with real aggregates when ready)
    return res.json({
      cards: {
        totalAdmins: await Admin.countDocuments(),
        // Add more KPIs when entities exist, e.g. matters, clients, invoices...
      }
    });
  } catch (e) {
    console.error("adminDashboard error", e);
    return res.status(500).json({ message: "Unable to load dashboard" });
  }
};

/** ---------- CRUD over Admin profiles (managed by admins) ---------- */

/** POST /api/admin */
export const createAdmin = async (req, res) => {
  try {
    const { name, mobile, password, email, firmId, address, qualifications } = req.body || {};
    if (!name || !mobile || !password || !firmId) return res.status(400).json({ message: "name, mobile, password and firm are required" });
    if (!(await firmExists(firmId))) return res.status(400).json({ message: "Firm not found. Please choose an existing firm." });

    const exists = await User.findOne({ mobile });
    if (exists) return res.status(409).json({ message: "Mobile already registered" });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, mobile, email, firmId, role: "admin", passwordHash });
    const admin = await Admin.create({ userId: user._id, name, mobile, email, address, qualifications, firmId });

    return res.status(201).json({ admin: toSafeAdminProfile(admin), user: toSafeUser(user) });
  } catch (e) {
    console.error("createAdmin error", e);
    return res.status(500).json({ message: "Unable to create admin" });
  }
};

/** GET /api/admin */
export const listAdmins = async (_req, res) => {
  try {
    const admins = await Admin.find().sort({ createdAt: -1 });
    return res.json({ admins: admins.map(toSafeAdminProfile) });
  } catch (e) {
    console.error("listAdmins error", e);
    return res.status(500).json({ message: "Unable to list admins" });
  }
};

/** GET /api/admin/:id */
export const getAdmin = async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id);
    if (!admin) return res.status(404).json({ message: "Admin not found" });
    return res.json({ admin: toSafeAdminProfile(admin) });
  } catch (e) {
    console.error("getAdmin error", e);
    return res.status(500).json({ message: "Unable to fetch admin" });
  }
};

/** PATCH /api/admin/:id */
export const updateAdmin = async (req, res) => {
  try {
    const allowed = ["name", "email", "mobile", "address", "qualifications", "firmId"];
    const updates = {};
    for (const k of allowed) if (k in req.body) updates[k] = req.body[k];

    const admin = await Admin.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    // Keep User fields (name/mobile/email/firmId) in sync if those changed
    const sync = {};
    ["name", "email", "mobile", "firmId"].forEach(k => { if (k in updates) sync[k] = updates[k]; });
    if (Object.keys(sync).length) await User.findByIdAndUpdate(admin.userId, sync);

    if ("password" in req.body && req.body.password) {
      await User.findByIdAndUpdate(admin.userId, { passwordHash: await bcrypt.hash(req.body.password, 12) });
    }

    return res.json({ admin: toSafeAdminProfile(admin) });
  } catch (e) {
    console.error("updateAdmin error", e);
    return res.status(500).json({ message: "Unable to update admin" });
  }
};

/** DELETE /api/admin/:id */
export const deleteAdmin = async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id);
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    await Admin.deleteOne({ _id: admin._id });
    // Also remove the underlying User (admin identity)
    await User.deleteOne({ _id: admin.userId });

    return res.status(204).send();
  } catch (e) {
    console.error("deleteAdmin error", e);
    return res.status(500).json({ message: "Unable to delete admin" });
  }
};
