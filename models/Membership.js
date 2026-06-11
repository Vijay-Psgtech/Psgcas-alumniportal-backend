// ─────────────────────────────────────────────────────────────────────────────
// models/Membership.js  —  Alumni Membership record
// ─────────────────────────────────────────────────────────────────────────────

const mongoose = require("mongoose");

const MembershipTiersSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    key: { type: String, required: true },
    amount: { type: Number, required: true },
    durationMonths: { type: Number, default: null },
  },
  { timestamps: true }
);

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
      validate: {
        validator: async function (value) {
          return !!(await MembershipTiers.exists({ key: value }));
        },
        message: (props) => `Invalid membership tier: ${props.value}`,
      },
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
MembershipSchema.methods.activate = async function (paymentId) {
  const tier = await MembershipTiers.findOne({ key: this.tier });
  this.membershipStatus = "ACTIVE";
  this.startDate = new Date();
  this.paymentId = paymentId;
  if (tier?.durationMonths) {
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + Number(tier.durationMonths));
    this.expiryDate = expiry;
  }
};

const Membership = mongoose.model("Membership", MembershipSchema);
const MembershipTiers = mongoose.model("MembershipTiers", MembershipTiersSchema);

module.exports = Membership;
module.exports.Membership = Membership;
module.exports.MembershipTiers = MembershipTiers;