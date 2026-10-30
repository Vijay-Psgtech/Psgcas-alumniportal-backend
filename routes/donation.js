// ─────────────────────────────────────────────────────────────────────────────
// routes/donation.js
// ─────────────────────────────────────────────────────────────────────────────
const express = require("express");
const router = express.Router();
const {
  initiateDonationPayment,
  getDonationStats,
  getRecentDonations,
  getDonationById,
  getDonationHistory,
} = require("../controllers/donationController");

// Public endpoints
router.get("/stats", getDonationStats);
router.get("/recent", getRecentDonations);
router.get("/history", getDonationHistory);

// Initiate (open to guests + logged-in users)
router.post("/initiate", initiateDonationPayment);
router.get("/:id", getDonationById);

module.exports = router;