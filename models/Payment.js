// ─────────────────────────────────────────────────────────────────────────────
// models/Payment.js  —  Unified Payment record for Membership & Donations
// ─────────────────────────────────────────────────────────────────────────────

const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema(
  {
    // ── Who paid ──────────────────────────────────────────────────────────────
    alumniId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Alumni",
      required: false,             // Donors may pay without an account
    },
    payerName: { type: String, required: true, trim: true },
    payerEmail: { type: String, required: true, lowercase: true, trim: true },
    payerPhone: { type: String, required: true, trim: true },

    // ── Transaction identifiers ───────────────────────────────────────────────
    txnid: { type: String, required: true, unique: true, index: true },
    easebuzzTxnId: { type: String, default: null },   // mihpayid from Easebuzz
    bankRefNum: { type: String, default: null },

    // ── Module type ───────────────────────────────────────────────────────────
    module: {
      type: String,
      required: true,
      enum: ["MEMBERSHIP", "DONATION"],
    },

    // ── Financial details ─────────────────────────────────────────────────────
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, default: "INR" },
    productinfo: { type: String, required: true },

    // ── Payment status lifecycle ──────────────────────────────────────────────
    status: {
      type: String,
      enum: ["INITIATED", "SUCCESS", "FAILURE", "PENDING", "CANCELLED"],
      default: "INITIATED",
      index: true,
    },

    // ── Easebuzz response payload (stored verbatim for audit) ─────────────────
    gatewayResponse: { type: mongoose.Schema.Types.Mixed, default: null },
    paymentMode: { type: String, default: null },   // e.g. "CC", "DC", "UPI"

    // ── Module-specific metadata (udf fields) ────────────────────────────────
    udf1: { type: String, default: "" },  // module = "MEMBERSHIP" | "DONATION"
    udf2: { type: String, default: "" },  // membershipTier  | donationCategory
    udf3: { type: String, default: "" },  // alumniId        | donorType
    udf4: { type: String, default: "" },  // graduationYear  | campaign
    udf5: { type: String, default: "" },  // additional meta | additional meta

    // ── Timestamps ────────────────────────────────────────────────────────────
    initiatedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Virtual: human-readable status label
PaymentSchema.virtual("statusLabel").get(function () {
  const labels = {
    INITIATED: "Payment Initiated",
    SUCCESS: "Payment Successful",
    FAILURE: "Payment Failed",
    PENDING: "Payment Pending",
    CANCELLED: "Payment Cancelled",
  };
  return labels[this.status] || this.status;
});

// Index for fast lookups
PaymentSchema.index({ payerEmail: 1, module: 1, status: 1 });
PaymentSchema.index({ module: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("Payment", PaymentSchema);