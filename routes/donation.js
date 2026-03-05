const express = require("express");
const router = express.Router();
const { createDonations, verifyRazorPay } = require("../controllers/donationController");

router.post("/", createDonations);
router.post("/verify-razorpay", verifyRazorPay);