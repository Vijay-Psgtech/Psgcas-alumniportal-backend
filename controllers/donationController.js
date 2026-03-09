// backend/controllers/donationController.js - COMPLETE DONATION FUNCTIONALITY (FIXED v2)
// ✅ Create donations
// ✅ Get user's donations with explicit populate
// ✅ Payment status updates
// ✅ Donation management
// ✅ Explicit .populate() instead of pre-hooks

const Donation = require("../models/Donation");
const Alumni = require("../models/Alumni");

// ✅ CREATE DONATION
exports.createDonation = async (req, res) => {
  try {
    console.log("\n💰 CREATE DONATION REQUEST");
    
    const { amount, currency, paymentMethod, message, isAnonymous } = req.body;
    const alumniId = req.user.id; // From auth middleware

    console.log("👤 Alumni ID:", alumniId);
    console.log("💵 Amount:", amount, currency);

    // Validate alumni exists
    const alumni = await Alumni.findById(alumniId);
    if (!alumni) {
      return res.status(404).json({
        message: "Alumni not found",
      });
    }

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        message: "Invalid amount",
      });
    }

    // Create donation
    const donation = new Donation({
      alumniId,
      amount,
      currency: currency || "INR",
      paymentMethod,
      message,
      isAnonymous: isAnonymous || false,
      status: "pending",
    });

    await donation.save();
    console.log("✅ Donation created:", donation._id);

    return res.status(201).json({
      message: "Donation created successfully",
      donation,
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return res.status(500).json({
      message: "Failed to create donation",
      error: error.message,
    });
  }
};

// ✅ GET MY DONATIONS (Alumni only) - FIXED v2 with explicit populate
exports.getMyDonations = async (req, res) => {
  try {
    console.log("\n📜 GET MY DONATIONS REQUEST");
    
    const alumniId = req.user.id;
    console.log("👤 Alumni ID:", alumniId);

    // FIXED: Explicit .populate() call instead of pre-hook
    const donations = await Donation.find({ alumniId })
      .sort({ createdAt: -1 })
      .populate("alumniId", "firstName lastName email")
      .exec();

    // Calculate statistics
    const completed = donations.filter(d => d.status === "completed");
    const totalAmount = completed
      .filter(d => d.currency === "INR")
      .reduce((sum, d) => sum + d.amount, 0);

    console.log(`✅ Found ${donations.length} donations`);

    return res.status(200).json({
      message: "Donations retrieved",
      donations,
      stats: {
        totalDonations: donations.length,
        completedDonations: completed.length,
        totalAmount,
      },
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return res.status(500).json({
      message: "Failed to retrieve donations",
      error: error.message,
    });
  }
};

// ✅ GET SINGLE DONATION - FIXED v2 with explicit populate
exports.getDonation = async (req, res) => {
  try {
    console.log("\n💳 GET DONATION REQUEST");
    
    const { id } = req.params;
    console.log("🔍 Donation ID:", id);

    // FIXED: Explicit .populate() call
    const donation = await Donation.findById(id)
      .populate("alumniId", "firstName lastName email")
      .exec();

    if (!donation) {
      return res.status(404).json({
        message: "Donation not found",
      });
    }

    // Check if user owns this donation (only alumni can view their own)
    if (donation.alumniId.toString() !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({
        message: "Not authorized to view this donation",
      });
    }

    console.log("✅ Donation retrieved");

    return res.status(200).json({
      message: "Donation retrieved",
      donation,
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return res.status(500).json({
      message: "Failed to retrieve donation",
      error: error.message,
    });
  }
};

// ✅ UPDATE DONATION (Admin only - update status) - FIXED v2
exports.updateDonation = async (req, res) => {
  try {
    console.log("\n📝 UPDATE DONATION REQUEST");
    
    const { id } = req.params;
    const { status, transactionId, paymentGatewayResponse, adminNotes } = req.body;
    console.log("🔍 Donation ID:", id);
    console.log("📊 Status:", status);

    // FIXED: Fetch donation first, then update
    const existingDonation = await Donation.findById(id);
    if (!existingDonation) {
      return res.status(404).json({
        message: "Donation not found",
      });
    }

    const donation = await Donation.findByIdAndUpdate(
      id,
      {
        status,
        transactionId: transactionId || existingDonation.transactionId,
        paymentGatewayResponse,
        adminNotes,
      },
      { new: true }
    )
    .populate("alumniId", "firstName lastName email")
    .exec();

    console.log(`✅ Donation updated: ${status}`);

    return res.status(200).json({
      message: "Donation updated successfully",
      donation,
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return res.status(500).json({
      message: "Failed to update donation",
      error: error.message,
    });
  }
};

// ✅ DELETE DONATION (Admin only)
exports.deleteDonation = async (req, res) => {
  try {
    console.log("\n🗑️ DELETE DONATION REQUEST");
    
    const { id } = req.params;
    console.log("🔍 Donation ID:", id);

    const donation = await Donation.findByIdAndDelete(id).exec();

    if (!donation) {
      return res.status(404).json({
        message: "Donation not found",
      });
    }

    console.log("✅ Donation deleted");

    return res.status(200).json({
      message: "Donation deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return res.status(500).json({
      message: "Failed to delete donation",
      error: error.message,
    });
  }
};

// ✅ ISSUE CERTIFICATE
exports.issueCertificate = async (req, res) => {
  try {
    console.log("\n📜 ISSUE CERTIFICATE REQUEST");
    
    const { id } = req.params;
    console.log("🔍 Donation ID:", id);

    const donation = await Donation.findByIdAndUpdate(
      id,
      { certificateIssued: true },
      { new: true }
    )
    .populate("alumniId", "firstName lastName email")
    .exec();

    if (!donation) {
      return res.status(404).json({
        message: "Donation not found",
      });
    }

    console.log("✅ Certificate issued");

    return res.status(200).json({
      message: "Certificate issued successfully",
      donation,
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return res.status(500).json({
      message: "Failed to issue certificate",
      error: error.message,
    });
  }
};

// ✅ GET DONATION STATISTICS
exports.getDonationStats = async (req, res) => {
  try {
    console.log("\n📊 GET DONATION STATS REQUEST");

    const stats = await Donation.aggregate([
      {
        $group: {
          _id: null,
          totalDonations: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
          avgAmount: { $avg: "$amount" },
          maxAmount: { $max: "$amount" },
          minAmount: { $min: "$amount" },
        },
      },
    ]);

    const statusStats = await Donation.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          amount: { $sum: "$amount" },
        },
      },
    ]);

    console.log("✅ Stats calculated");

    return res.status(200).json({
      message: "Donation statistics retrieved",
      stats: stats[0] || {},
      statusStats,
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return res.status(500).json({
      message: "Failed to retrieve statistics",
      error: error.message,
    });
  }
};