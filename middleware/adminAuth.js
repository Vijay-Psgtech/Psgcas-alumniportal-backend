// backend/middleware/auth.js - CREATE THIS FILE IF MISSING
// ✅ JWT token verification middleware
// ✅ Protects authenticated routes

const jwt = require("jsonwebtoken");

/**
 * ✅ Auth Middleware - Verify JWT Token
 * 
 * Usage: router.get("/protected-route", authMiddleware, controllerFunction)
 * 
 * This middleware:
 * 1. Extracts token from Authorization header (Bearer <token>)
 * 2. Verifies token signature and expiration
 * 3. Adds decoded user info to req.user
 * 4. Allows next middleware/controller to access req.user
 */
const authMiddleware = (req, res, next) => {
  try {
    console.log("\n🔐 === AUTH MIDDLEWARE ===");
    console.log("Headers:", req.headers);

    // ✅ Step 1: Extract token from Authorization header
    const authHeader = req.headers.authorization;
    console.log("Auth header:", authHeader?.substring(0, 20) + "...");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("❌ No token or invalid format");
      return res.status(401).json({
        success: false,
        message: "No token provided or invalid format",
      });
    }

    // Extract token (remove "Bearer " prefix)
    const token = authHeader.split(" ")[1];
    console.log("Token extracted:", token.substring(0, 20) + "...");

    // ✅ Step 2: Verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key-change-in-production"
    );

    console.log("✅ Token verified");
    console.log("Decoded user:", decoded.email);
    console.log("User ID:", decoded.id);
    console.log("isAdmin:", decoded.isAdmin);

    // ✅ Step 3: Add user info to request object
    req.user = {
      id: decoded.id,
      email: decoded.email,
      isAdmin: decoded.isAdmin,
    };

    console.log("✅ User attached to request");

    // ✅ Step 4: Move to next middleware/controller
    next();
  } catch (error) {
    console.error("❌ Token verification error:", error.message);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token has expired",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    res.status(401).json({
      success: false,
      message: "Authentication failed",
    });
  }
};

/**
 * ✅ Admin Auth Middleware - Verify Admin Privileges
 * 
 * Usage: router.get("/admin-only", authMiddleware, adminAuthMiddleware, controllerFunction)
 * 
 * This middleware ensures:
 * - User is authenticated (authMiddleware already checked this)
 * - User has admin privileges (isAdmin === true)
 */
const adminAuthMiddleware = (req, res, next) => {
  try {
    console.log("\n👮 === ADMIN AUTH MIDDLEWARE ===");

    if (!req.user) {
      console.log("❌ No user in request");
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!req.user.isAdmin) {
      console.log("❌ User is not admin. isAdmin =", req.user.isAdmin);
      return res.status(403).json({
        success: false,
        message: "Admin privileges required",
      });
    }

    console.log("✅ Admin verified:", req.user.email);
    next();
  } catch (error) {
    console.error("❌ Admin auth error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

module.exports = {
  authMiddleware,
  adminAuthMiddleware,
};