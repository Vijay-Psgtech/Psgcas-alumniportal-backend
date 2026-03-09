// backend/routes/admin.js - COMPLETE ADMIN ROUTES
// ✅ All admin endpoints
// ✅ Protected with authMiddleware and adminMiddleware
// ✅ Complete CRUD operations

const express = require("express");
const router = express.Router();
const {
  getAllAlumni,
  getAlumniDetail,
  approveAlumni,
  rejectAlumni,
  getAllDonations,
  getDonationDetail,
  updateDonationStatus,
  getDashboardStats,
  exportAlumniData,
} = require("../controllers/adminController");
const { authMiddleware, adminMiddleware } = require("../middleware/auth");

// ── ALL ROUTES REQUIRE AUTHENTICATION AND ADMIN ROLE ──

// ALUMNI MANAGEMENT
router.get("/alumni", authMiddleware, adminMiddleware, getAllAlumni);
router.get("/alumni/:id", authMiddleware, adminMiddleware, getAlumniDetail);
router.put("/alumni/:id/approve", authMiddleware, adminMiddleware, approveAlumni);
router.put("/alumni/:id/reject", authMiddleware, adminMiddleware, rejectAlumni);

// DONATIONS MANAGEMENT
router.get("/donations", authMiddleware, adminMiddleware, getAllDonations);
router.get("/donations/:id", authMiddleware, adminMiddleware, getDonationDetail);
router.put("/donations/:id/status", authMiddleware, adminMiddleware, updateDonationStatus);

// DASHBOARD
router.get("/dashboard/stats", authMiddleware, adminMiddleware, getDashboardStats);

// EXPORTS
router.get("/export/alumni", authMiddleware, adminMiddleware, exportAlumniData);

module.exports = router;