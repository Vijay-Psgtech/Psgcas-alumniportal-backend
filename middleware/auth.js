// backend/middleware/auth.js
// ✅ COMPLETE AND FIXED - All three middleware functions properly organized

const jwt = require("jsonwebtoken");
const Alumni = require("../models/Alumni");

// ─────────────────────────────────────────────────────────────────────────────
// AUTH MIDDLEWARE — Verify JWT and attach user to req.user
// ─────────────────────────────────────────────────────────────────────────────
// Purpose: Verify JWT token and extract user data
// Must run FIRST before admin/subAdmin middleware
// Attaches: req.user, req.userId
const authMiddleware = (req, res, next) => {
  try {
    // ✅ Support both httpOnly cookie (preferred) and Authorization header
    const token =
      req.cookies?.token || 
      req.headers.authorization?.split(" ")[1] ||
      req.headers.authorization?.replace("Bearer ", "").trim();

    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: "No authentication token provided" 
      });
    }

    // Verify JWT signature and expiry
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === "TokenExpiredError") {
        return res.status(401).json({ 
          success: false,
          message: "Token expired. Please log in again." 
        });
      }
      throw new Error("Invalid token");
    }

    // ✅ FIX: Normalize decoded data
    // JWT contains 'id', but MongoDB uses '_id'
    // Attach both for consistency
    req.user = {
      ...decoded,
      _id: decoded.id || decoded._id, // Map id to _id for MongoDB consistency
    };
    req.userId = decoded.id || decoded._id; // Convenience alias

    console.log("✅ Auth Success:", {
      _id: req.user._id,
      role: req.user.role,
      isAdmin: req.user.isAdmin,
    });

    next();
  } catch (error) {
    console.error("❌ authMiddleware error:", error.message);
    return res.status(401).json({ 
      success: false,
      message: "Invalid or expired token. Please log in again." 
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN MIDDLEWARE — Check if user is super admin
// ─────────────────────────────────────────────────────────────────────────────
// Purpose: Verify user has isAdmin flag set to true
// Must run AFTER authMiddleware
// Guards: Super admin routes only
const adminMiddleware = (req, res, next) => {
  try {
    // authMiddleware must have run first
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        message: "Not authenticated" 
      });
    }

    // Check if user is a super admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ 
        success: false,
        message: "Admin access required. Super-admin privileges needed." 
      });
    }

    console.log("✅ Admin Check Passed:", req.user._id);
    next();
  } catch (error) {
    console.error("❌ adminMiddleware error:", error);
    return res.status(500).json({ 
      success: false,
      message: "Server error in authorization" 
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SUB-ADMIN MIDDLEWARE — Check role and fetch fresh department data
// ─────────────────────────────────────────────────────────────────────────────
// Purpose: Verify user is sub-admin and has an assigned department
// Must run AFTER authMiddleware
// Does: Validates role + fetchesfresh data from DB to prevent stale JWTs
// Guards: Sub-admin scoped routes only
const subAdminMiddleware = async (req, res, next) => {
  try {
    // authMiddleware must have run first
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        message: "Not authenticated" 
      });
    }

    // Step 1: Basic role check from JWT (fast)
    if (req.user.role !== "subAdmin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Sub-admin privileges required.",
      });
    }

    // Step 2: Re-fetch from database to ensure fresh data
    // This prevents stale JWTs from bypassing a department reassignment
    // (e.g., if admin changed this user's department after they logged in)
    const freshUser = await Alumni.findById(req.user._id)
      .select("-password")
      .populate(
        "assignedDepartment",
        "name degree programmeType fundingType active"
      );

    if (!freshUser) {
      return res.status(404).json({
        success: false,
        message: "User account not found.",
      });
    }

    // Step 3: Verify sub-admin role is still active
    if (freshUser.role !== "subAdmin") {
      return res.status(403).json({
        success: false,
        message: "Sub-admin access has been revoked. Contact your administrator.",
      });
    }

    // Step 4: Verify sub-admin is approved
    if (!freshUser.isApproved) {
      return res.status(403).json({
        success: false,
        message: "Your sub-admin account has been deactivated. Contact your administrator.",
      });
    }

    // Step 5: Verify department is assigned
    if (!freshUser.assignedDepartment) {
      return res.status(403).json({
        success: false,
        message: "No department assigned to your account. Contact your administrator.",
      });
    }

    // ✅ CRITICAL: Overwrite req.user with fresh DB data
    // Now req.user has:
    // - Current role status
    // - Current approval status
    // - Current assignedDepartment (populated)
    // - No stale JWT data
    req.user = freshUser;

    console.log("✅ Sub-Admin Check Passed:", {
      _id: req.user._id,
      department: req.user.assignedDepartment?.name,
    });

    next();
  } catch (error) {
    console.error("❌ subAdminMiddleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error in authorization",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT ALL MIDDLEWARE FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  authMiddleware,
  adminMiddleware,
  subAdminMiddleware,
};

// ─────────────────────────────────────────────────────────────────────────────
// USAGE EXAMPLES
// ─────────────────────────────────────────────────────────────────────────────

// Example 1: Public route (no auth required)
// router.get("/public-data", getPublicData);

// Example 2: Authenticated route (auth required)
// router.get("/my-profile", authMiddleware, getProfile);

// Example 3: Admin-only route (must be super admin)
// router.get("/admin/stats", authMiddleware, adminMiddleware, getStats);

// Example 4: Sub-admin scoped route (must be sub-admin with department)
// router.get("/sub-admin/my-department/alumni", authMiddleware, subAdminMiddleware, getDepartmentAlumni);

// Example 5: Chain multiple middleware
// router.put("/admin/approve/:id", 
//   authMiddleware,        // Step 1: Verify JWT
//   adminMiddleware,       // Step 2: Verify is admin
//   approveAlumni          // Step 3: Do the action
// );