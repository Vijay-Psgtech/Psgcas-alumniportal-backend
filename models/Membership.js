// ─────────────────────────────────────────────────────────────────────────────
// models/Membership.js  —  Alumni Membership record
// ─────────────────────────────────────────────────────────────────────────────

const mongoose = require("mongoose");

// Membership tiers and their fees (in INR)
const MEMBERSHIP_TIERS = {
  // ANNUAL: { label: "Annual Membership", amount: 500, durationMonths: 12 },
  LIFETIME : { label: "Lifetime Membership", amount: 600, durationMonths: null },
  TEST: { label: "Test Membership", amount: 1, durationMonths: 1 }, // For testing purposes
  // STUDENT: { label: "Student Membership", amount: 200, durationMonths: 12 },
  // CORPORATE: { label: "Corporate Membership", amount: 10000, durationMonths: 12 },
};

const MembershipSchema = new mongoose.Schema(
  {
    // ── User reference ────────────────────────────────────────────────────────
    alumniId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Alumni",
      required: true,
      index: true,
    },

    // ── Registration details ──────────────────────────────────────────────────
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    batchYear: { type: Number, required: true },
    department: { type: String, required: true, trim: true },

    // ── Membership tier ───────────────────────────────────────────────────────
    tier: {
      type: String,
      required: true,
      enum: Object.keys(MEMBERSHIP_TIERS),
    },
    amount: { type: Number, required: true },

    // ── Dates ─────────────────────────────────────────────────────────────────
    startDate: { type: Date, default: null },
    expiryDate: { type: Date, default: null },

    // ── Status ────────────────────────────────────────────────────────────────
    membershipStatus: {
      type: String,
      enum: ["PENDING_PAYMENT", "ACTIVE", "EXPIRED", "CANCELLED"],
      default: "PENDING_PAYMENT",
      index: true,
    },

    // ── Payment reference ─────────────────────────────────────────────────────
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },
    txnid: { type: String, default: null },

    // ── Address ───────────────────────────────────────────────────────────────
    address: {
      city: String,
      state: String,
      country: { type: String, default: "India" },
      pincode: String,
    },
  },
  { timestamps: true }
);

// Activate membership after successful payment
MembershipSchema.methods.activate = function (paymentId) {
  const tier = MEMBERSHIP_TIERS[this.tier];
  this.membershipStatus = "ACTIVE";
  this.startDate = new Date();
  this.paymentId = paymentId;
  if (tier.durationMonths) {
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + tier.durationMonths);
    this.expiryDate = expiry;
  }
};

module.exports = mongoose.model("Membership", MembershipSchema);
module.exports.MEMBERSHIP_TIERS = MEMBERSHIP_TIERS;