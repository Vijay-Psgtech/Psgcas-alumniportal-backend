// backend/controllers/adminAuthController.js - FULLY FIXED
// ✅ Uses Alumni model (was Admin - CRITICAL FIX)
// ✅ Returns isAdmin flag in response
// ✅ Proper error handling and logging
// ✅ All functions defined before export
// ✅ Matches frontend expectations

const Alumni = require("../models/Alumni"); // ✅ FIXED: Was "Admin", now "Alumni"
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

// ═══════════════════════════════════════════════════════════════════════════
// ✅ HELPER: Generate JWT Token
// ═══════════════════════════════════════════════════════════════════════════

const generateToken = (alumni) => {
  return jwt.sign(
    {
      id: alumni._id,
      email: alumni.email,
      isAdmin: alumni.isAdmin,
    },
    process.env.JWT_SECRET || "your-secret-key-change-in-production",
    { expiresIn: "7d" }
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// @route   POST /api/auth/login
// @desc    Admin login (using Alumni model)
// @access  Public
// ═══════════════════════════════════════════════════════════════════════════

const adminLogin = async (req, res) => {
  try {
    console.log("\n🔐 === ADMIN LOGIN REQUEST ===");
    console.log("Body:", req.body);

    const { email, password } = req.body;

    // ✅ Step 1: Validate input
    if (!email || !password) {
      console.log("❌ Missing email or password");
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    console.log(`🔍 Looking for admin: ${email}`);

    // ✅ Step 2: Find alumni by email (include password field for comparison)
    const alumni = await Alumni.findOne({ email }).select("+password");

    if (!alumni) {
      console.log("❌ Alumni not found:", email);
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    console.log("✅ Alumni found:", alumni.email);

    // ✅ Step 3: Check if user is admin
    if (!alumni.isAdmin) {
      console.log("❌ Not an admin:", email);
      console.log("isAdmin value:", alumni.isAdmin);
      return res.status(403).json({
        success: false,
        message: "Admin access required. This account does not have admin privileges.",
      });
    }

    console.log("✅ User is admin");

    // ✅ Step 4: Check if account is approved
    if (!alumni.isApproved) {
      console.log("❌ Account not approved:", email);
      return res.status(403).json({
        success: false,
        message: "Your account is pending approval. Please wait for admin confirmation.",
      });
    }

    console.log("✅ Account approved");

    // ✅ Step 5: Compare passwords using bcrypt
    const isPasswordMatch = await bcrypt.compare(password, alumni.password);

    if (!isPasswordMatch) {
      console.log("❌ Wrong password for:", email);
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    console.log("✅ Password valid");

    // ✅ Step 6: Generate JWT token
    const token = generateToken(alumni);

    console.log("✅ Token generated:", token.substring(0, 20) + "...");

    // ✅ Step 7: Update last login timestamp
    await Alumni.findByIdAndUpdate(alumni._id, { lastLogin: new Date() });

    console.log("✅ Last login updated");

    // ✅ Step 8: Send response WITH isAdmin flag (CRITICAL!)
    console.log("✅ ADMIN LOGIN SUCCESSFUL:", email);
    console.log("═══════════════════════════════════════\n");

    res.json({
      success: true,
      token,
      alumni: {
        _id: alumni._id,
        email: alumni.email,
        firstName: alumni.firstName,
        lastName: alumni.lastName,
        phone: alumni.phone || "",
        department: alumni.department || "",
        graduationYear: alumni.graduationYear || null,
        city: alumni.city || "",
        country: alumni.country || "",
        isAdmin: alumni.isAdmin,  // ⭐ CRITICAL - must be true
        isApproved: alumni.isApproved,
      },
    });
  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during login",
      error: error.message,
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// @route   GET /api/auth/profile
// @desc    Get current admin profile (requires auth)
// @access  Private
// ═══════════════════════════════════════════════════════════════════════════

const getAdminProfile = async (req, res) => {
  try {
    console.log("\n👤 === GET ADMIN PROFILE ===");
    console.log("User ID from token:", req.user.id);

    const alumni = await Alumni.findById(req.user.id).select("-password");

    if (!alumni) {
      console.log("❌ Alumni not found");
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    console.log("✅ Profile retrieved:", alumni.email);

    res.json({
      success: true,
      message: "Admin profile retrieved",
      alumni,
    });
  } catch (error) {
    console.error("❌ Profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// @route   POST /api/auth/logout
// @desc    Logout (token cleared on frontend)
// @access  Private
// ═══════════════════════════════════════════════════════════════════════════

const adminLogout = async (req, res) => {
  try {
    console.log("\n👋 === ADMIN LOGOUT ===");
    console.log("User:", req.user.email);

    res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("❌ Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// ✅ EXPORTS - All functions defined above before export
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  adminLogin,
  getAdminProfile,
  adminLogout,
};