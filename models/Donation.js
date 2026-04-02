// backend/models/Donation.js
// ✅ UPDATED:
//   - pan field added (String, regex validated at schema level)
//   - aadhaar field added (String, 12-digit numeric)
//   - amount min raised to 5000 (INR floor)
//   - currency restricted to INR only (Razorpay only, as per product spec)

const mongoose = require("mongoose");

const donationSchema = new mongoose.Schema(
  {
    // ── Donor Info ─────────────────────────────────────────────────────────
    donorName: {
      type: String,
      required: true,
      trim: true,
    },
    donorEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    isAnonymous: {
      type: Boolean,
      default: false,
    },

    // ── KYC Fields ─────────────────────────────────────────────────────────
    pan: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      validate: {
        validator: (v) => /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v),
        message: "Invalid PAN format. Expected format: AAAAA9999A",
      },
    },
    aadhaar: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: (v) => /^[0-9]{12}$/.test(v),
        message: "Aadhaar must be exactly 12 digits",
      },
    },

    // ── Donation Details ────────────────────────────────────────────────────
    amount: {
      type: Number,
      required: true,
      min: [5000, "Minimum donation amount is ₹5,000"],
      max: [25000, "Maximum donation amount is ₹25,000"],
    },
    currency: {
      type: String,
      enum: ["INR"],          // INR only — Razorpay only per product spec
      default: "INR",
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ["razorpay", "UPI", "Net Banking", "Card"],
      default: "razorpay",
      required: true,
    },
    message: {
      type: String,
      default: "",
      trim: true,
    },

    // ── Payment Info ────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "cancelled"],
      default: "pending",
    },
    transactionId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    paymentGateway: {
      type: String,
      enum: ["razorpay", "manual", null],
      default: null,
    },
    razorpayOrderId: {
      type: String,
      default: null,
    },

    // ── Alumni Link (optional) ──────────────────────────────────────────────
    alumniId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Alumni",
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

donationSchema.index({ alumniId: 1, status: 1 });
donationSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Donation", donationSchema);