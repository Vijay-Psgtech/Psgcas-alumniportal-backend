const express = require("express");
const router = express.Router();
const { createDonations, verifyRazorPay, getAllDonations } = require("../controllers/donationController");

router.post("/", createDonations);
router.post("/verify-razorpay", verifyRazorPay);
router.get("/donations", getAllDonations);

module.exports = router;