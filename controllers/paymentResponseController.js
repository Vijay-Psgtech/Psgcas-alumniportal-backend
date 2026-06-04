// ─────────────────────────────────────────────────────────────────────────────
// controllers/paymentResponseController.js
// Handles the POST callback from Easebuzz after payment (surl / furl)
// ─────────────────────────────────────────────────────────────────────────────
//
//  FLOW:
//   1. Easebuzz POSTs to /api/payment/response  (same URL for success & failure)
//   2. We verify the response hash (tamper-proofing)
//   3. We update Payment, Membership, or Donation records in DB
//   4. We redirect the user to the React frontend success/failure page
// ─────────────────────────────────────────────────────────────────────────────

const Payment = require("../models/Payment");
const Membership = require("../models/Membership");
const Donation = require("../models/Donation");
const Alumni = require("../models/Alumni");
const { EASEBUZZ_CONFIG } = require("../config/easebuzz");
const { verifyResponseHash } = require("../utils/easebuzzHelper");

const handlePaymentResponse = async (req, res) => {
  try {
    const responseData = req.body;
    const {
      txnid, status, amount, productinfo,
      firstname, email, easepayid, bank_ref_num,
      payment_source, PG_TYPE, mode, udf1, udf5,
    } = responseData;

    console.log(`[PaymentResponse] txnid=${txnid} status=${status}`);

    // ── 1. Hash Verification (CRITICAL security check) ──────────────────────
    const isHashValid = verifyResponseHash(responseData);
    if (!isHashValid) {
      console.error(`[PaymentResponse] HASH MISMATCH for txnid=${txnid}`);
      // Redirect to failure page with tamper error
      return res.redirect(
        `${EASEBUZZ_CONFIG.frontendFailureUrl}?txnid=${txnid}&reason=hash_mismatch`
      );
    }

    // ── 2. Find the Payment record ───────────────────────────────────────────
    const payment = await Payment.findOne({ txnid });
    if (!payment) {
      console.error(`[PaymentResponse] Payment not found for txnid=${txnid}`);
      return res.redirect(
        `${EASEBUZZ_CONFIG.frontendFailureUrl}?txnid=${txnid}&reason=not_found`
      );
    }

    // Idempotency: already processed
    if (payment.status === "SUCCESS") {
      return res.redirect(
        `${EASEBUZZ_CONFIG.frontendSuccessUrl}?txnid=${txnid}&module=${payment.module}`
      );
    }

    // ── 3. Map Easebuzz status to our status ────────────────────────────────
    const normalizedStatus =
      status === "success"
        ? "SUCCESS"
        : status === "pending"
        ? "PENDING"
        : "FAILURE";

    // ── 4. Update Payment record ─────────────────────────────────────────────
    payment.status = normalizedStatus;
    payment.easebuzzTxnId = easepayid || null;
    payment.bankRefNum = bank_ref_num || null;
    payment.paymentMode = PG_TYPE || payment_source || mode || null;
    payment.gatewayResponse = responseData;
    payment.completedAt = new Date();
    await payment.save();

    // ── 5. Update module-specific record ─────────────────────────────────────
    const module = udf1 || payment.module;            // udf1 = "MEMBERSHIP" | "DONATION"
    const recordId = udf5 || payment.udf5;             // udf5 = the record's ObjectId

    if (normalizedStatus === "SUCCESS") {
      if (module === "MEMBERSHIP") {
        const membership = await Membership.findById(recordId);
        if (membership) {
          membership.activate(payment._id);
          await membership.save();
        }

        // Also update alumni's membershipStatus to "ACTIVE"
        if (membership && membership.alumniId) {
          await Alumni.findByIdAndUpdate(membership.alumniId, {
            membershipStatus: "ACTIVE",
          });
        }

      } else if (module === "DONATION") {
        const donation = await Donation.findById(recordId);
        if (donation) {
          donation.complete(payment._id);
          await donation.save();
        }
      }
    } else {
      // Mark the module record as failed/pending
      if (module === "MEMBERSHIP") {
        await Membership.findByIdAndUpdate(recordId, {
          membershipStatus: normalizedStatus === "PENDING" ? "PENDING_PAYMENT" : "CANCELLED",
        });

        // If membership failed, also update alumni's membershipStatus to "PENDING_PAYMENT" or "CANCELLED"
        const membership = await Membership.findById(recordId);
        if (membership && membership.alumniId) {
          await Alumni.findByIdAndUpdate(membership.alumniId, {
            membershipStatus: normalizedStatus === "PENDING" ? "PENDING_PAYMENT" : "CANCELLED",
          });
        }

      } else if (module === "DONATION") {
        await Donation.findByIdAndUpdate(recordId, {
          status: normalizedStatus,
        });
      }
    }

    // ── 6. Redirect to frontend ───────────────────────────────────────────────
    const redirectBase =
      normalizedStatus === "SUCCESS"
        ? EASEBUZZ_CONFIG.frontendSuccessUrl
        : EASEBUZZ_CONFIG.frontendFailureUrl;

    return res.redirect(
      `${redirectBase}?txnid=${txnid}&module=${module}&status=${normalizedStatus}&id=${recordId}`
    );
  } catch (err) {
    console.error("[PaymentResponse] handler error:", err.message);
    return res.redirect(
      `${EASEBUZZ_CONFIG.frontendFailureUrl}?reason=server_error`
    );
  }
};

// ─── GET /api/payment/status/:txnid ──────────────────────────────────────────
// Frontend polls this to get the final payment status
const getPaymentStatus = async (req, res) => {
  try {
    const payment = await Payment.findOne({ txnid: req.params.txnid }).select(
      "txnid status module amount productinfo paymentMode completedAt easebuzzTxnId udf5 gatewayResponse"
    );
    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found." });
    }
    res.json({ success: true, payment });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = { handlePaymentResponse, getPaymentStatus };