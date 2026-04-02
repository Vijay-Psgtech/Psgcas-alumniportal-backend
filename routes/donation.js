// backend/routes/donationRoutes.js
const express = require("express");
const router = express.Router();
const {
  createDonations,
  verifyRazorPay,
  getAllDonations,
} = require("../controllers/donationController");

// POST /api/donations          — create donation + get Razorpay order
router.post("/", createDonations);

// POST /api/donations/verify-razorpay  — verify payment signature
router.post("/verify-razorpay", verifyRazorPay);

// GET  /api/donations          — admin: all donations (KYC fields excluded)
router.get("/", getAllDonations);

module.exports = router;