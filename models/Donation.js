// ─────────────────────────────────────────────────────────────────────────────
// models/Donation.js  —  Alumni Donation record
// ─────────────────────────────────────────────────────────────────────────────

const mongoose = require("mongoose");

// Donation categories available in the alumni portal
const DONATION_CATEGORIES = {
  SCHOLARSHIP: {
    label: "Scholarship Fund",
    description: "Support deserving students with scholarships",
    minAmount: 500,
  },
  STUDENT_WELLNESS: {
    label: "Student Wellness",
    description: "Mental health and wellness programs for students",
    minAmount: 200,
  },
  CAMPUS_INFRASTRUCTURE: {
    label: "Campus Infrastructure",
    description: "Labs, libraries, and campus development",
    minAmount: 1000,
  },
  RESEARCH_FUND: {
    label: "Research & Innovation Fund",
    description: "Support student and faculty research projects",
    minAmount: 500,
  },
  SPORTS_DEVELOPMENT: {
    label: "Sports Development",
    description: "Sports facilities and inter-college competitions",
    minAmount: 200,
  },
  CULTURAL_ACTIVITIES: {
    label: "Cultural Activities",
    description: "Annual cultural events and art programs",
    minAmount: 200,
  },
  GENERAL: {
    label: "General Fund",
    description: "Institution's general development fund",
    minAmount: 100,
  },
};

const DonationSchema = new mongoose.Schema(
  {
    // ── Donor identity ────────────────────────────────────────────────────────
    alumniId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "alumni",
      default: null,              // Anonymous donations are allowed
    },
    donorName: { type: String, required: true, trim: true },
    donorEmail: { type: String, required: true, lowercase: true, trim: true },
    donorPhone: { type: String, required: true, trim: true },
    isAnonymous: { type: Boolean, default: false },

    // ── Donation details ──────────────────────────────────────────────────────
    category: {
      type: String,
      required: true,
      enum: Object.keys(DONATION_CATEGORIES),
    },
    amount: { type: Number, required: true, min: 1 },
    message: { type: String, trim: true, maxlength: 500, default: "" },

    // ── Campaign / fund drive ──────────────────────────────────────────────────
    campaign: { type: String, default: "GENERAL", trim: true },
    dedicatedTo: { type: String, trim: true, default: "" }, // "In memory of..."

    // ── Tax benefit details (80G India) ───────────────────────────────────────
    pan: { type: String, uppercase: true, trim: true, default: "" },
    taxReceiptRequested: { type: Boolean, default: false },
    taxReceiptSent: { type: Boolean, default: false },
    taxReceiptNumber: { type: String, default: null },

    // ── Status ────────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["INITIATED", "SUCCESS", "FAILURE", "PENDING"],
      default: "INITIATED",
      index: true,
    },

    // ── Payment reference ─────────────────────────────────────────────────────
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },
    txnid: { type: String, default: null, index: true },

    // ── Donor address (for receipt) ───────────────────────────────────────────
    address: {
      line1: String,
      city: String,
      state: String,
      country: { type: String, default: "India" },
      pincode: String,
    },
  },
  { timestamps: true }
);

// Indexes for reporting
DonationSchema.index({ category: 1, status: 1 });
DonationSchema.index({ donorEmail: 1, status: 1 });
DonationSchema.index({ campaign: 1, status: 1 });

// Virtual: formatted category label
DonationSchema.virtual("categoryLabel").get(function () {
  return DONATION_CATEGORIES[this.category]?.label || this.category;
});

// Mark donation complete after successful payment
DonationSchema.methods.complete = function (paymentId) {
  this.status = "SUCCESS";
  this.paymentId = paymentId;
};

module.exports = mongoose.model("Donation", DonationSchema);
module.exports.DONATION_CATEGORIES = DONATION_CATEGORIES;