// backend/models/Donation.js - COMPLETE DONATION MODEL (FIXED v2)
// ✅ All donation fields
// ✅ Status tracking
// ✅ Alumni reference
// ✅ REMOVED problematic pre-find hooks - using explicit populate in controller instead

const mongoose = require("mongoose");

const donationSchema = new mongoose.Schema(
  {
    // Reference to Alumni
    alumniId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Alumni",
      required: true,
    },

    // Donation Details
    amount: {
      type: Number,
      required: true,
      min: 1,
    },

    currency: {
      type: String,
      enum: ["INR", "USD"],
      default: "INR",
    },

    // Payment Method
    paymentMethod: {
      type: String,
      enum: ["card", "upi", "bank_transfer", "cheque", "other"],
      required: true,
    },

    // Transaction Details
    transactionId: {
      type: String,
      unique: true,
      sparse: true,
    },

    // Status Tracking
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded"],
      default: "pending",
    },

    // Payment Gateway Response
    paymentGatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // Message (optional)
    message: {
      type: String,
      default: null,
    },

    // Admin Notes
    adminNotes: {
      type: String,
      default: null,
    },

    // Timestamp
    donatedAt: {
      type: Date,
      default: Date.now,
    },

    // Payment Completion Time
    completedAt: {
      type: Date,
      default: null,
    },

    // Tax Deduction Certificate (if applicable)
    certificateIssued: {
      type: Boolean,
      default: false,
    },

    certificateUrl: {
      type: String,
      default: null,
    },

    // Anonymous Donation
    isAnonymous: {
      type: Boolean,
      default: false,
    },

    // Recurring Donation
    isRecurring: {
      type: Boolean,
      default: false,
    },

    recurringFrequency: {
      type: String,
      enum: ["monthly", "quarterly", "yearly"],
      default: null,
    },

    nextDueDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ✅ Index for faster queries
donationSchema.index({ alumniId: 1 });
donationSchema.index({ status: 1 });
donationSchema.index({ createdAt: -1 });
donationSchema.index({ transactionId: 1 });

// ✅ Pre-save middleware - SIMPLE AND CLEAN
donationSchema.pre("save", function (next) {
  if (this.status === "completed" && !this.completedAt) {
    this.completedAt = new Date();
  }
  next();
});

// NOTE: Removed pre-find hooks entirely!
// Instead, we'll use explicit .populate() in the controller.
// This is cleaner, more performant, and avoids middleware complexities.

module.exports = mongoose.model("Donation", donationSchema);