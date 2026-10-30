// ─────────────────────────────────────────────────────────────────────────────
// routes/membership.js
// ─────────────────────────────────────────────────────────────────────────────
const express = require("express");
const router = express.Router();
const {
  getMembershipTiers,
  initiateMembershipPayment,
  getMembershipById,
  getMembershipByUser,
  getAllMembershipData,
} = require("../controllers/MembershipController");
const adminAuth = require("../middleware/adminAuth");

// Public
router.get("/tiers", getMembershipTiers);

// Requires auth middleware in production
router.post("/initiate", initiateMembershipPayment);
router.get("/user/:userId", getMembershipByUser);
router.get("/:id", getMembershipById);
router.get("/all/data", adminAuth, getAllMembershipData); // Admin route to get all membership data

module.exports = router;