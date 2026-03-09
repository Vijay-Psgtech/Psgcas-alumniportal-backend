// backend/controllers/adminController.js - COMPLETE ADMIN FUNCTIONALITY
// ✅ Get all alumni with filtering
// ✅ Approve/reject alumni
// ✅ View all donations
// ✅ Dashboard statistics
// ✅ Admin management

const Alumni = require("../models/Alumni");
const Donation = require("../models/Donation");

// ✅ GET ALL ALUMNI (with pagination, filtering)
exports.getAllAlumni = async (req, res) => {
  try {
    console.log("\n📋 GET ALL ALUMNI REQUEST");
    
    const { page = 1, limit = 10, approved, search } = req.query;
    const skip = (page - 1) * limit;

    let query = {};

    // Filter by approval status
    if (approved !== undefined) {
      query.isApproved = approved === "true";
    }

    // Search by name or email
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    console.log("🔍 Query:", query);

    // Get total count
    const total = await Alumni.countDocuments(query);

    // Get alumni with pagination
    const alumni = await Alumni.find(query)
      .select("-password") // Never return password
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    console.log(`✅ Found ${alumni.length} alumni`);

    return res.status(200).json({
      message: "Alumni list retrieved",
      alumni,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return res.status(500).json({
      message: "Failed to retrieve alumni",
      error: error.message,
    });
  }
};

// ✅ GET SINGLE ALUMNI DETAILS
exports.getAlumniDetail = async (req, res) => {
  try {
    console.log("\n👤 GET ALUMNI DETAIL REQUEST");
    
    const { id } = req.params;
    console.log("🔍 Alumni ID:", id);

    const alumni = await Alumni.findById(id).select("-password");

    if (!alumni) {
      return res.status(404).json({
        message: "Alumni not found",
      });
    }

    // Get donation history
    const donations = await Donation.find({ alumniId: id });

    console.log(`✅ Alumni found with ${donations.length} donations`);

    return res.status(200).json({
      message: "Alumni details retrieved",
      alumni,
      donations,
      totalDonations: donations.reduce((sum, d) => sum + d.amount, 0),
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return res.status(500).json({
      message: "Failed to retrieve alumni details",
      error: error.message,
    });
  }
};

// ✅ APPROVE ALUMNI
exports.approveAlumni = async (req, res) => {
  try {
    console.log("\n✅ APPROVE ALUMNI REQUEST");
    
    const { id } = req.params;
    console.log("🔍 Alumni ID:", id);

    const alumni = await Alumni.findByIdAndUpdate(
      id,
      { isApproved: true },
      { new: true }
    ).select("-password");

    if (!alumni) {
      return res.status(404).json({
        message: "Alumni not found",
      });
    }

    console.log(`✅ Alumni approved: ${alumni.email}`);

    return res.status(200).json({
      message: "Alumni approved successfully",
      alumni,
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return res.status(500).json({
      message: "Failed to approve alumni",
      error: error.message,
    });
  }
};

// ✅ REJECT ALUMNI (soft delete - mark as rejected)
exports.rejectAlumni = async (req, res) => {
  try {
    console.log("\n❌ REJECT ALUMNI REQUEST");
    
    const { id } = req.params;
    const { reason } = req.body;
    console.log("🔍 Alumni ID:", id);

    const alumni = await Alumni.findByIdAndUpdate(
      id,
      {
        isApproved: false,
        rejectionReason: reason || "Rejected by admin",
      },
      { new: true }
    ).select("-password");

    if (!alumni) {
      return res.status(404).json({
        message: "Alumni not found",
      });
    }

    console.log(`❌ Alumni rejected: ${alumni.email}`);

    return res.status(200).json({
      message: "Alumni rejected",
      alumni,
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return res.status(500).json({
      message: "Failed to reject alumni",
      error: error.message,
    });
  }
};

// ✅ GET ALL DONATIONS
exports.getAllDonations = async (req, res) => {
  try {
    console.log("\n💰 GET ALL DONATIONS REQUEST");
    
    const { page = 1, limit = 10, status, alumniId } = req.query;
    const skip = (page - 1) * limit;

    let query = {};

    if (status) {
      query.status = status;
    }

    if (alumniId) {
      query.alumniId = alumniId;
    }

    console.log("🔍 Query:", query);

    // Get total count
    const total = await Donation.countDocuments(query);

    // Get donations with alumni details
    const donations = await Donation.find(query)
      .populate("alumniId", "firstName lastName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Calculate stats
    const completed = donations.filter(d => d.status === "completed");
    const totalAmount = completed.reduce((sum, d) => sum + d.amount, 0);

    console.log(`✅ Found ${donations.length} donations`);

    return res.status(200).json({
      message: "Donations list retrieved",
      donations,
      stats: {
        total,
        completed: completed.length,
        totalAmount,
        avgAmount: completed.length > 0 ? totalAmount / completed.length : 0,
      },
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
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

// ✅ GET DONATION BY ID
exports.getDonationDetail = async (req, res) => {
  try {
    console.log("\n💳 GET DONATION DETAIL REQUEST");
    
    const { id } = req.params;
    console.log("🔍 Donation ID:", id);

    const donation = await Donation.findById(id).populate(
      "alumniId",
      "firstName lastName email phone city country"
    );

    if (!donation) {
      return res.status(404).json({
        message: "Donation not found",
      });
    }

    console.log(`✅ Donation found`);

    return res.status(200).json({
      message: "Donation details retrieved",
      donation,
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return res.status(500).json({
      message: "Failed to retrieve donation details",
      error: error.message,
    });
  }
};

// ✅ UPDATE DONATION STATUS
exports.updateDonationStatus = async (req, res) => {
  try {
    console.log("\n📝 UPDATE DONATION STATUS REQUEST");
    
    const { id } = req.params;
    const { status, message } = req.body;
    console.log("🔍 Donation ID:", id);
    console.log("📊 New status:", status);

    const donation = await Donation.findByIdAndUpdate(
      id,
      { status, message },
      { new: true }
    ).populate("alumniId", "firstName lastName email");

    if (!donation) {
      return res.status(404).json({
        message: "Donation not found",
      });
    }

    console.log(`✅ Donation status updated to: ${status}`);

    return res.status(200).json({
      message: "Donation status updated",
      donation,
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return res.status(500).json({
      message: "Failed to update donation status",
      error: error.message,
    });
  }
};

// ✅ GET DASHBOARD STATISTICS
exports.getDashboardStats = async (req, res) => {
  try {
    console.log("\n📊 GET DASHBOARD STATS REQUEST");

    // Count alumni by approval status
    const totalAlumni = await Alumni.countDocuments();
    const approvedAlumni = await Alumni.countDocuments({ isApproved: true });
    const pendingAlumni = await Alumni.countDocuments({ isApproved: false });

    // Count donations by status
    const totalDonations = await Donation.countDocuments();
    const completedDonations = await Donation.countDocuments({ status: "completed" });
    const pendingDonations = await Donation.countDocuments({ status: "pending" });
    const failedDonations = await Donation.countDocuments({ status: "failed" });

    // Calculate total amount
    const donationStats = await Donation.aggregate([
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          completedAmount: {
            $sum: {
              $cond: [{ $eq: ["$status", "completed"] }, "$amount", 0],
            },
          },
          avgAmount: { $avg: "$amount" },
        },
      },
    ]);

    const stats = donationStats[0] || {
      totalAmount: 0,
      completedAmount: 0,
      avgAmount: 0,
    };

    // Get recent activity
    const recentAlumni = await Alumni.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("firstName lastName email createdAt isApproved");

    const recentDonations = await Donation.find()
      .populate("alumniId", "firstName lastName email")
      .sort({ createdAt: -1 })
      .limit(5);

    console.log("✅ Dashboard stats calculated");

    return res.status(200).json({
      message: "Dashboard statistics retrieved",
      stats: {
        alumni: {
          total: totalAlumni,
          approved: approvedAlumni,
          pending: pendingAlumni,
        },
        donations: {
          total: totalDonations,
          completed: completedDonations,
          pending: pendingDonations,
          failed: failedDonations,
          totalAmount: stats.totalAmount,
          completedAmount: stats.completedAmount,
          avgAmount: Math.round(stats.avgAmount),
        },
      },
      recentAlumni,
      recentDonations,
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return res.status(500).json({
      message: "Failed to retrieve dashboard statistics",
      error: error.message,
    });
  }
};

// ✅ EXPORT ALUMNI DATA (CSV)
exports.exportAlumniData = async (req, res) => {
  try {
    console.log("\n📥 EXPORT ALUMNI DATA REQUEST");

    const alumni = await Alumni.find().select("-password");

    const csv = [
      ["First Name", "Last Name", "Email", "Department", "Year", "Country", "City", "Approved", "Created At"],
      ...alumni.map(a => [
        a.firstName,
        a.lastName,
        a.email,
        a.department,
        a.graduationYear,
        a.country,
        a.city,
        a.isApproved ? "Yes" : "No",
        new Date(a.createdAt).toLocaleDateString(),
      ]),
    ]
      .map(row => row.join(","))
      .join("\n");

    console.log(`✅ Exporting ${alumni.length} alumni`);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=alumni-data.csv");
    return res.send(csv);
  } catch (error) {
    console.error("❌ Error:", error);
    return res.status(500).json({
      message: "Failed to export alumni data",
      error: error.message,
    });
  }
};