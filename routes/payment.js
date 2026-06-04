// ─────────────────────────────────────────────────────────────────────────────
// routes/payment.js
// ─────────────────────────────────────────────────────────────────────────────
const express = require("express");
const router = express.Router();
const {
  handlePaymentResponse,
  getPaymentStatus,
} = require("../controllers/paymentResponseController");

// Easebuzz POSTs here after payment (surl & furl both point here)
router.post("/response", handlePaymentResponse);

// Frontend polls for status
router.get("/status/:txnid", getPaymentStatus);

module.exports = router;