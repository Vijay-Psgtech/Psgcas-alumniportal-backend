// backend/routes/adminAuth.js - FIXED
// ✅ Routes for admin authentication
// ✅ Uses corrected controller
// ✅ Proper route structure

const express = require("express");
const router = express.Router();
const {
  adminLogin,
  getAdminProfile,
  adminLogout,
} = require("../controllers/adminAuthController");
const { authMiddleware, adminAuthMiddleware } = require("../middleware/auth");

// ═══════════════════════════════════════════════════════════════════════════
// 🔓 PUBLIC ROUTES (No authentication required)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @route   POST /api/auth/login
 * @desc    Admin login - returns token and user data
 * @access  Public
 * 
 * Request body:
 * {
 *   "email": "admin@psgarts.edu",
 *   "password": "Admin@123"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "token": "eyJ...",
 *   "alumni": {
 *     "email": "...",
 *     "isAdmin": true
 *   }
 * }
 */
router.post("/login", adminLogin);

// ═══════════════════════════════════════════════════════════════════════════
// 🔐 PROTECTED ROUTES (Authentication required)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @route   GET /api/auth/profile
 * @desc    Get current admin profile
 * @access  Private (requires valid JWT token)
 * 
 * Headers:
 * Authorization: Bearer <token>
 */
router.get("/profile", authMiddleware, getAdminProfile);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout (clear token on frontend)
 * @access  Private (requires valid JWT token)
 * 
 * Headers:
 * Authorization: Bearer <token>
 */
router.post("/logout", authMiddleware, adminLogout);

// ═══════════════════════════════════════════════════════════════════════════
// Export router
// ═══════════════════════════════════════════════════════════════════════════

module.exports = router;