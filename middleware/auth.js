const jwt = require("jsonwebtoken");

// ── Verify JWT token ─────────────────────────────────────────────
const authMiddleware = (req, res, next) => {
  try {
    // Prefer HttpOnly cookie; fall back to Authorization header for API clients
    const token =
      req.cookies?.token || req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    req.userId = decoded.id; // convenience alias used in some controllers
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired" });
    }
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

// ── Verify admin flag on already-authenticated request ───────────
const adminMiddleware = (req, res, next) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

module.exports = { authMiddleware, adminMiddleware };
