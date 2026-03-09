// backend/routes/donation.js - COMPLETE DONATION ROUTES (FIXED)
// ✅ Alumni donation management
// ✅ Admin donation control
// ✅ Statistics and reporting
// ✅ Fixed route ordering

const express = require("express");
const router = express.Router();
const {
  createDonation,
  getMyDonations,
  getDonation,
  updateDonation,
  deleteDonation,
  issueCertificate,
  getDonationStats,
} = require("../controllers/donationController");
const { authMiddleware, adminMiddleware } = require("../middleware/auth");

// ── PROTECTED ROUTES (Alumni) ──

// Create donation (alumni)
router.post("/", authMiddleware, createDonation);

// Get donation statistics (admin) - MUST come before /:id route
router.get("/stats/all", authMiddleware, adminMiddleware, getDonationStats);

// Get my donations (alumni)
router.get("/my-donations", authMiddleware, getMyDonations);

// Get single donation (alumni or admin)
router.get("/:id", authMiddleware, getDonation);

// ── ADMIN ONLY ROUTES ──

// Update donation status (admin)
router.put("/:id", authMiddleware, adminMiddleware, updateDonation);

// Delete donation (admin)
router.delete("/:id", authMiddleware, adminMiddleware, deleteDonation);

// Issue certificate (admin)
router.post("/:id/certificate", authMiddleware, adminMiddleware, issueCertificate);

module.exports = router;