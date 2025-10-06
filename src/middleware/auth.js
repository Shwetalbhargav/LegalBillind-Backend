// middleware/auth.js
import jwt from "jsonwebtoken";

/**
 * Authenticate a request using a JWT supplied either via:
 *  - Cookie: req.cookies.token
 *  - Header: Authorization: Bearer <token>
 */
export const authenticate = (req, res, next) => {
  try {
    const token =
      req.cookies?.token ||
      (req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.split(" ")[1]
        : null);

    if (!token) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "supersecretkey"
    );

    // Attach minimal identity to the request
    req.user = { id: decoded.id, role: decoded.role, email: decoded.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

/**
 * Role-based authorization middleware factory.
 * Usage: authorize("admin"), authorize("admin", "owner")
 */
export const authorize =
  (...allowedRoles) =>
  (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (allowedRoles.length && !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden: insufficient role" });
    }
    next();
  };

/**
 * Back-compat aliases so routes can import { protect, adminOnly }.
 * - `protect` is equivalent to `authenticate`
 * - `adminOnly` is a ready-made middleware that only allows role "admin"
 */
export { authenticate as protect };
export const adminOnly = authorize("admin");
