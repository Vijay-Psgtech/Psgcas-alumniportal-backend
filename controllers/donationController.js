// ─────────────────────────────────────────────────────────────────────────────
// controllers/donationController.js
// ─────────────────────────────────────────────────────────────────────────────

const axios = require("axios");
const Donation = require("../models/Donation");
const { DONATION_CATEGORIES } = require("../models/Donation");
const Payment = require("../models/Payment");
const { EASEBUZZ_CONFIG } = require("../config/easebuzz");
const {
  generateInitiateHash,
  generateTxnId,
  formatAmount,
} = require("../utils/Easebuzzhelper");

// ─── GET /api/donation/categories ─────────────────────────────────────────────
const getDonationCategories = (req, res) => {
  const categories = Object.entries(DONATION_CATEGORIES).map(([key, value]) => ({
    key,
    ...value,
  }));
  res.json({ success: true, categories });
};

// ─── POST /api/donation/initiate ──────────────────────────────────────────────
// Step 1: Collect donor info, create Donation record, initiate Easebuzz payment
const initiateDonationPayment = async (req, res) => {
  try {
    const {
      donorName, donorEmail, donorPhone,
      category, amount, message,
      isAnonymous, pan, taxReceiptRequested,
      campaign, dedicatedTo,
      address, userId,
    } = req.body;

    // Validate category
    const selectedCategory = DONATION_CATEGORIES[category?.toUpperCase()];
    if (!selectedCategory) {
      return res.status(400).json({ success: false, message: "Invalid donation category." });
    }

    // Minimum amount check
    if (parseFloat(amount) < selectedCategory.minAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum donation for ${selectedCategory.label} is ₹${selectedCategory.minAmount}.`,
      });
    }

    const txnid = generateTxnId("DON");
    const formattedAmount = formatAmount(amount);
    const productinfo = `Donation - ${selectedCategory.label}`;
    const displayName = isAnonymous ? "Anonymous Donor" : donorName;

    // Create Donation record
    const donation = await Donation.create({
      userId: userId || null,
      donorName, donorEmail, donorPhone,
      category: category.toUpperCase(),
      amount: parseFloat(amount),
      message, isAnonymous, pan,
      taxReceiptRequested: !!taxReceiptRequested,
      campaign: campaign || "GENERAL",
      dedicatedTo,
      address,
      txnid,
      status: "INITIATED",
    });

    // Create Payment record
    const payment = await Payment.create({
      userId: userId || null,
      payerName: displayName,
      payerEmail: donorEmail,
      payerPhone: donorPhone,
      txnid,
      module: "DONATION",
      amount: parseFloat(amount),
      productinfo,
      status: "INITIATED",
      udf1: "DONATION",
      udf2: category.toUpperCase(),
      udf3: isAnonymous ? "ANONYMOUS" : "NAMED",
      udf4: campaign || "GENERAL",
      udf5: String(donation._id),
    });

    // Build Easebuzz payload
    // Note: Easebuzz 'firstname' must be a name (not anonymous for hash)
    const payerFirstName = donorName.split(" ")[0];

    const easebuzzPayload = {
      key: EASEBUZZ_CONFIG.key,
      txnid,
      amount: formattedAmount,
      productinfo,
      firstname: payerFirstName,
      email: donorEmail,
      phone: donorPhone,
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

    // Call Easebuzz Initiate API
    const ebResponse = await axios.post(
      EASEBUZZ_CONFIG.initiatePaymentUrl,
      new URLSearchParams(easebuzzPayload).toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const { data } = ebResponse;

    if (data?.status === 1 && data?.data) {
      return res.json({
        success: true,
        txnid,
        paymentUrl: `https://${
          EASEBUZZ_CONFIG.env === "prod" ? "pay" : "testpay"
        }.easebuzz.in/${data.data}`,
        donationId: donation._id,
      });
    } else {
      await Payment.findByIdAndUpdate(payment._id, { status: "FAILURE" });
      await Donation.findByIdAndUpdate(donation._id, { status: "FAILURE" });
      return res.status(400).json({
        success: false,
        message: data?.error_desc || "Payment initiation failed. Please try again.",
      });
    }
  } catch (err) {
    console.error("[DonationPayment] initiate error:", err.message);
    res.status(500).json({ success: false, message: "Server error during payment initiation." });
  }
};

// ─── GET /api/donation/stats ───────────────────────────────────────────────
// Public stats for donation wall / progress bar
const getDonationStats = async (req, res) => {
  try {
    const stats = await Donation.aggregate([
      { $match: { status: "SUCCESS" } },
      {
        $group: {
          _id: "$category",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);
    const totalRaised = stats.reduce((sum, s) => sum + s.totalAmount, 0);
    res.json({ success: true, stats, totalRaised });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── GET /api/donation/recent ──────────────────────────────────────────────
// Recent donations for donation wall (non-anonymous only)
const getRecentDonations = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const donations = await Donation.find({
      status: "SUCCESS",
      isAnonymous: false,
    })
      .select("donorName category amount message campaign createdAt")
      .sort({ createdAt: -1 })
      .limit(limit);
    res.json({ success: true, donations });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── GET /api/donation/:id ─────────────────────────────────────────────────
const getDonationById = async (req, res) => {
  try {
    const donation = await Donation.findById(req.params.id).populate("paymentId");
    if (!donation) {
      return res.status(404).json({ success: false, message: "Donation not found." });
    }
    res.json({ success: true, donation });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = {
  getDonationCategories,
  initiateDonationPayment,
  getDonationStats,
  getRecentDonations,
  getDonationById,
};