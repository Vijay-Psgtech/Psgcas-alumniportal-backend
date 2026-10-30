// ─────────────────────────────────────────────────────────────────────────────
// controllers/donationController.js
// ─────────────────────────────────────────────────────────────────────────────

const axios = require("axios");
const Donation = require("../models/Donation");
const Payment = require("../models/Payment");
const { EASEBUZZ_CONFIG } = require("../config/easebuzz");
const {
  generateInitiateHash,
  generateTxnId,
  formatAmount,
} = require("../utils/easebuzzHelper");

// ─── POST /api/donation/initiate ──────────────────────────────────────────────
// Step 1: Collect donor info, create Donation record, initiate Easebuzz payment
const initiateDonationPayment = async (req, res) => {
  try {
    const {
      donorName,
      donorEmail,
      donorPhone,
      category,
      amount,
      message,
      isAnonymous,
      pan,
      aadhaar,
      taxReceiptRequested,
      campaign,
      dedicatedTo,
      address,
      userId,
    } = req.body;

    const txnid = generateTxnId("DON");
    const formattedAmount = formatAmount(amount);
    const productinfo = `Donation - ${category}`;
    const displayName = isAnonymous ? "Anonymous Donor" : donorName;

    // Create Donation record
    const donation = await Donation.create({
      userId: userId || null,
      donorName,
      donorEmail,
      donorPhone,
      category: category,
      amount: parseFloat(amount),
      message,
      isAnonymous,
      pan,
      aadhaar,
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
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    );

    const { data } = ebResponse;

    if (data?.status === 1 && data?.data) {
      return res.json({
        success: true,
        txnid,
        paymentUrl: `https://${
          EASEBUZZ_CONFIG.env === "prod" ? "pay" : "testpay"
        }.easebuzz.in/pay/${data.data}`,
        donationId: donation._id,
      });
    } else {
      await Payment.findByIdAndUpdate(payment._id, { status: "FAILURE" });
      await Donation.findByIdAndUpdate(donation._id, { status: "FAILURE" });
      return res.status(400).json({
        success: false,
        message:
          data?.error_desc || "Payment initiation failed. Please try again.",
      });
    }
  } catch (err) {
    console.error("[DonationPayment] initiate error:", err.message);
    res
      .status(500)
      .json({
        success: false,
        message: "Server error during payment initiation.",
      });
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
    const donation = await Donation.findById(req.params.id).populate(
      "paymentId",
    );
    if (!donation) {
      return res
        .status(404)
        .json({ success: false, message: "Donation not found." });
    }
    res.json({ success: true, donation });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ═════════════════════════════════════════════════════════════════════════
// GET DONATION HISTORY WITH FILTERS & PAGINATION
// ═════════════════════════════════════════════════════════════════════════

const getDonationHistory = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status = "all",
      currency = "all",
      paymentMethod = "all",
      donorType = "all",
      search = "",
      sortBy = "createdAt",
      sortOrder = "desc",
      startDate = "",
      endDate = "",
      minAmount = "",
      maxAmount = "",
    } = req.query;

    // Build filter object
    const filter = {};

    if (status !== "all") {
      filter.status = status;
    }

    if (currency !== "all") {
      filter.currency = currency;
    }

    if (paymentMethod !== "all") {
      filter.paymentMethod = paymentMethod;
    }

    if (donorType === "anonymous") {
      filter.isAnonymous = true;
    } else if (donorType === "individual") {
      filter.isAnonymous = false;
    }

    // Search filter (name, email, transaction ID)
    if (search) {
      filter.$or = [
        { donorName: new RegExp(search, "i") },
        { donorEmail: new RegExp(search, "i") },
        { transactionId: new RegExp(search, "i") },
      ];
    }

    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    // Amount range filter
    if (minAmount || maxAmount) {
      filter.amount = {};
      if (minAmount) {
        filter.amount.$gte = parseFloat(minAmount);
      }
      if (maxAmount) {
        filter.amount.$lte = parseFloat(maxAmount);
      }
    }

    // Sorting
    const sortObj = {};
    sortObj[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const donations = await Donation.find(filter)
      .populate("paymentId", "gatewayResponse currency")
      .sort(sortObj)
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Donation.countDocuments(filter);
    const pages = Math.ceil(total / parseInt(limit));

    // Calculate stats
    const allDonations = await Donation.find(filter);
    const stats = {
      total: allDonations.length,
      completed: allDonations.filter((d) => d.status === "SUCCESS").length,
      pending: allDonations.filter((d) => d.status === "PENDING").length,
      failed: allDonations.filter((d) => d.status === "FAILURE").length,
      cancelled: allDonations.filter((d) => d.status === "cancelled").length,
      flagged: allDonations.filter((d) => d.adminFlagged).length,
      totalAmount: allDonations.reduce((sum, d) => sum + d.amount, 0),
      averageAmount:
        allDonations.length > 0
          ? Math.round(
              allDonations.reduce((sum, d) => sum + d.amount, 0) /
                allDonations.length,
            )
          : 0,
    };

    console.log(`✅ Fetched donation history - Page ${page}, Total: ${total}`);

    return res.json({
      success: true,
      donations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages,
      },
      stats,
    });
  } catch (error) {
    console.error("❌ Error fetching donation history:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch donation history",
      error: error.message,
    });
  }
};

module.exports = {
  initiateDonationPayment,
  getDonationStats,
  getRecentDonations,
  getDonationById,
  getDonationHistory
};