const axios = require("axios");
const Membership = require("../models/Membership");
const { MembershipTiers } = require("../models/Membership");
const Alumni = require("../models/Alumni");
const Payment = require("../models/Payment");
const { EASEBUZZ_CONFIG } = require("../config/easebuzz");
const {
    generateInitiateHash,
    generateTxnId,
    formatAmount
    
} = require("../utils/easebuzzHelper");
 

// GET /api/membership/tiers
const getMembershipTiers = async (req, res) => {
  const tiers = await MembershipTiers.find();
  res.json({ success: true, tiers });
};

// POST /api/membership/initiate
// Step 1: Collect registration data, create a Membership record, initiate payment
const initiateMembershipPayment = async (req, res) => {
  try {
    const {
      firstName, lastName, email, phone,
      batchYear, department, tier,
      address, userId,
    } = req.body;
 
    // Validate tier
    const selectedTier = await MembershipTiers.findOne({ key: tier?.toUpperCase() });
    if (!selectedTier) {
      return res.status(400).json({ success: false, message: "Invalid membership tier." });
    }
 
    // Prevent duplicate active memberships
    const existing = await Membership.findOne({
      email,
      membershipStatus: { $in: ["ACTIVE", "PENDING_PAYMENT"] },
    });
    if (existing) { 
      return res.status(400).json({
        success: false,
        message: "An active or pending membership already exists for this email.",
      });
    }
 
    const txnid = generateTxnId("MEM");
    const amount = formatAmount(selectedTier.amount);
    const productinfo = `Alumni Membership - ${selectedTier.label}`;
 
    // Create Membership record (status: PENDING_PAYMENT)
    const membership = await Membership.create({
      alumniId: userId || null,
      firstName, lastName, email, phone,
      batchYear, department,
      tier: tier.toUpperCase(),
      amount: selectedTier.amount,
      txnid,
      address,
    });
 
    // Create Payment record
    const payment = await Payment.create({
      alumniId: userId || null,
      payerName: `${firstName} ${lastName}`,
      payerEmail: email,
      payerPhone: phone,
      txnid,
      module: "MEMBERSHIP",
      amount: selectedTier.amount,
      productinfo,
      status: "INITIATED",
      udf1: "MEMBERSHIP",
      udf2: tier.toUpperCase(),
      udf3: membership.alumniId || "",
      udf4: String(batchYear),
      udf5: String(membership._id),
    });
 
    // Build Easebuzz payload
    const easebuzzPayload = {
      key: EASEBUZZ_CONFIG.key,
      txnid,
      amount,
      productinfo,
      firstname: firstName,
      email,
      phone,
      surl: EASEBUZZ_CONFIG.successUrl,
      furl: EASEBUZZ_CONFIG.failureUrl,
      udf1: payment.udf1,
      udf2: payment.udf2,
      udf3: payment.udf3,
      udf4: payment.udf4,
      udf5: payment.udf5,
    };
 
    // Generate hash
    easebuzzPayload.hash = generateInitiateHash(easebuzzPayload);
 
    // Call Easebuzz Initiate Payment API
    const ebResponse = await axios.post(
      EASEBUZZ_CONFIG.initiatePaymentUrl,
      new URLSearchParams(easebuzzPayload).toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
 
    const { data } = ebResponse;
 
    if (data?.status === 1 && data?.data) {
      // need to update membershipStatus in alumni collection to "PENDING_PAYMENT"
      if (membership.alumniId) {
        await Alumni.findByIdAndUpdate(membership.alumniId, {
          membershipStatus: "PENDING_PAYMENT",
        });
      }

      // Return the payment_url to frontend for redirect
      return res.json({
        success: true,
        txnid,
        paymentUrl: `https://${
          EASEBUZZ_CONFIG.env === "prod" ? "pay" : "testpay"
        }.easebuzz.in/pay/${data.data}`,
        membershipId: membership._id,
      });
    } else {
      // Easebuzz rejected the initiation
      await Payment.findByIdAndUpdate(payment._id, { status: "FAILURE" });
      await Membership.findByIdAndUpdate(membership._id, {
        membershipStatus: "CANCELLED",
      });
      return res.status(400).json({
        success: false,
        message: data?.error_desc || "Payment initiation failed. Try again.",
      });
    }
  } catch (err) {
    console.error("[MembershipPayment] initiate error:", err.message);
    res.status(500).json({ success: false, message: "Server error during payment initiation." });
  }
};


// ─── GET /api/membership/:id ──────────────────────────────────────────────────
const getMembershipById = async (req, res) => {
  try {
    const membership = await Membership.findById(req.params.id).populate("paymentId");
    if (!membership) {
      return res.status(404).json({ success: false, message: "Membership not found." });
    }
    res.json({ success: true, membership });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};


// ─── GET /api/membership/user/:alumniId ─────────────────────────────────────────
const getMembershipByUser = async (req, res) => {
  try {
    const memberships = await Membership.find({ alumniId: req.params.alumniId })
      .sort({ createdAt: -1 })
      .populate("paymentId");
    res.json({ success: true, memberships });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── GET /api/all/membership data (firstName, lastName, email, phone, membershipStatus, amount ) ─────────────────────────────────────────
const getAllMembershipData = async (req, res) => {
  try {
    const memberships = await Membership.find({})
      .select("firstName lastName email phone membershipStatus amount createdAt")
      .sort({ createdAt: -1 });
    res.json({ success: true, memberships });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};



module.exports = {
  getMembershipTiers,
  initiateMembershipPayment,
  getMembershipById,
  getMembershipByUser,
  getAllMembershipData,
};