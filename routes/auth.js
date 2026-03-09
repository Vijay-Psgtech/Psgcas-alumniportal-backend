// backend/routes/auth.js - FULLY FIXED VERSION
// ✅ Fixed import case (authController with capital C)
// ✅ All endpoints working
// ✅ Proper middleware integration

const express = require("express");
const router = express.Router();
const {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  verifyOtp,
  resetPassword,
} = require("../controllers/authController");  // ✅ FIXED: Capital 'C' in authController
const { authMiddleware } = require("../middleware/auth");

// ── Public routes (no authentication required) ────────────────────
router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp", verifyOtp);
router.post("/reset-password", resetPassword);

// ── Protected routes (require valid JWT token) ────────────────────
router.get("/profile", authMiddleware, getProfile);
router.put("/profile", authMiddleware, updateProfile);
router.put("/change-password", authMiddleware, changePassword);

module.exports = router;