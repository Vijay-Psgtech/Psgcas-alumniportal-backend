// backend/routes/adminDash.js - FULLY FIXED
// ✅ Correct middleware import path
// ✅ All routes properly protected
// ✅ Controllers imported correctly

const express = require("express");
const router = express.Router();

// ✅ FIXED: Import the correct middleware from the correct path
// The middleware is in backend/middleware/auth.js (or authenticate.js)
// NOT in a separate adminAuth.js file
const { authMiddleware, adminMiddleware } = require("../middleware/auth");

// Import all controllers
const {
  getAllAlumniForAdmin,
  getPendingAlumni,
  getAlumniDetail,
  approveAlumni,
  rejectAlumni,
  makeAlumniAdmin,
  getAllDonations,
  getDonationDetail,
  updateDonationStatus,
  getDashboardStats,
} = require("../controllers/adminDashController");

// ✅ PROTECT ALL ROUTES with authentication AND admin middleware
router.use(authMiddleware);      // Step 1: Verify token
router.use(adminMiddleware);     // Step 2: Verify admin privilege

// ============ ALUMNI MANAGEMENT ROUTES ============

// Get all alumni
router.get("/alumni/all", getAllAlumniForAdmin);

// Get pending alumni
router.get("/alumni/pending", getPendingAlumni);

// Get single alumni detail
router.get("/alumni/:id", getAlumniDetail);

// Approve alumni registration
router.put("/alumni/:id/approve", approveAlumni);

// Reject alumni registration
router.put("/alumni/:id/reject", rejectAlumni);

// Grant admin privileges
router.put("/alumni/:id/make-admin", makeAlumniAdmin);

// ============ DONATION MANAGEMENT ROUTES ============

// Get all donations
router.get("/donations", getAllDonations);

// Get single donation detail
router.get("/donations/:id", getDonationDetail);

// Update donation status
router.put("/donations/:id/status", updateDonationStatus);

// ============ STATISTICS ROUTE ============

// Get dashboard statistics
router.get("/stats", getDashboardStats);

module.exports = router;