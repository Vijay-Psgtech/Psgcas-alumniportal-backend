// backend/controllers/adminDashController.js
// ✅ FIXED: returnDocument:"after" → { new: true } (correct Mongoose option)
const Alumni = require("../models/Alumni");
const Donation = require("../models/Donation");

// ======================== ALUMNI MANAGEMENT ========================

// GET /api/admin/dashboard/alumni/all
exports.getAllAlumniForAdmin = async (req, res) => {
  try {
    const { status, search, department, graduationYear, sortBy } = req.query;

    let filter = {};
    if (status === "pending") filter.isApproved = false;
    else if (status === "approved") filter.isApproved = true;
    if (department) filter.department = department;
    if (graduationYear) filter.graduationYear = parseInt(graduationYear);
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName:  { $regex: search, $options: "i" } },
        { email:     { $regex: search, $options: "i" } },
        { currentCompany: { $regex: search, $options: "i" } },
      ];
    }

    let sortOptions = { createdAt: -1 };
    if (sortBy === "name")  sortOptions = { firstName: 1, lastName: 1 };
    else if (sortBy === "email") sortOptions = { email: 1 };
    else if (sortBy === "year")  sortOptions = { graduationYear: -1 };

    const alumni = await Alumni.find(filter).select("-password").sort(sortOptions);

    res.json({ message: "Alumni retrieved successfully", count: alumni.length, alumni });
  } catch (error) {
    console.error("Get All Alumni Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// GET /api/admin/dashboard/alumni/pending
exports.getPendingAlumni = async (req, res) => {
  try {
    const alumni = await Alumni.find({ isApproved: false })
      .select("-password")
      .sort({ createdAt: -1 });

    res.json({ message: "Pending alumni retrieved successfully", count: alumni.length, alumni });
  } catch (error) {
    console.error("Get Pending Alumni Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// GET /api/admin/dashboard/alumni/:id
exports.getAlumniDetail = async (req, res) => {
  try {
    const alumni = await Alumni.findById(req.params.id).select("-password");
    if (!alumni) return res.status(404).json({ message: "Alumni not found" });

    const donations = await Donation.find({ alumniId: req.params.id }).sort({ createdAt: -1 });

    res.json({
      message: "Alumni details retrieved successfully",
      alumni: {
        ...alumni.toObject(),
        donations,
        totalDonated: donations.reduce((sum, d) => sum + (d.status === "completed" ? d.amount : 0), 0),
      },
    });
  } catch (error) {
    console.error("Get Alumni Detail Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// PUT /api/admin/dashboard/alumni/:id/approve
exports.approveAlumni = async (req, res) => {
  try {
    // ✅ FIX: { new: true } not returnDocument:"after"
    const alumni = await Alumni.findByIdAndUpdate(
      req.params.id,
      { isApproved: true },
      { new: true }
    ).select("-password");

    if (!alumni) return res.status(404).json({ message: "Alumni not found" });

    res.json({ message: "Alumni approved successfully", alumni });
  } catch (error) {
    console.error("Approve Alumni Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// PUT /api/admin/dashboard/alumni/:id/reject
exports.rejectAlumni = async (req, res) => {
  try {
    const alumni = await Alumni.findByIdAndDelete(req.params.id);
    if (!alumni) return res.status(404).json({ message: "Alumni not found" });

    await Donation.deleteMany({ alumniId: req.params.id });

    res.json({ message: "Alumni registration rejected and deleted" });
  } catch (error) {
    console.error("Reject Alumni Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// PUT /api/admin/dashboard/alumni/:id/make-admin
exports.makeAlumniAdmin = async (req, res) => {
  try {
    // ✅ FIX: { new: true }
    const alumni = await Alumni.findByIdAndUpdate(
      req.params.id,
      { isAdmin: true },
      { new: true }
    ).select("-password");

    if (!alumni) return res.status(404).json({ message: "Alumni not found" });

    res.json({ message: "Admin privileges granted successfully", alumni });
  } catch (error) {
    console.error("Make Admin Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ======================== DONATION MANAGEMENT ========================

// GET /api/admin/dashboard/donations
exports.getAllDonations = async (req, res) => {
  try {
    const { status, currency, paymentMethod, startDate, endDate, sortBy } = req.query;

    let filter = {};
    if (status)        filter.status = status;
    if (currency)      filter.currency = currency;
    if (paymentMethod) filter.paymentMethod = paymentMethod;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate)   filter.createdAt.$lte = new Date(endDate);
    }

    let sortOptions = { createdAt: -1 };
    if (sortBy === "amount") sortOptions = { amount: -1 };
    else if (sortBy === "donor") sortOptions = { donorName: 1 };

    const donations = await Donation.find(filter)
      .populate("alumniId", "firstName lastName email")
      .sort(sortOptions);

    const completed = donations.filter((d) => d.status === "completed");
    const summary = {
      totalDonations: donations.length,
      completedDonations: completed.length,
      totalAmount: completed.reduce((sum, d) => sum + d.amount, 0),
      pendingAmount: donations
        .filter((d) => d.status === "pending")
        .reduce((sum, d) => sum + d.amount, 0),
    };

    res.json({ message: "Donations retrieved successfully", count: donations.length, summary, donations });
  } catch (error) {
    console.error("Get Donations Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// GET /api/admin/dashboard/donations/:id
exports.getDonationDetail = async (req, res) => {
  try {
    const donation = await Donation.findById(req.params.id).populate("alumniId");
    if (!donation) return res.status(404).json({ message: "Donation not found" });

    res.json({ message: "Donation details retrieved successfully", donation });
  } catch (error) {
    console.error("Get Donation Detail Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// PUT /api/admin/dashboard/donations/:id/status
exports.updateDonationStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!["pending", "completed", "failed", "refunded"].includes(status)) {
      return res.status(400).json({ message: "Invalid donation status" });
    }

    // ✅ FIX: { new: true }
    const donation = await Donation.findByIdAndUpdate(
      req.params.id,
      { status, completedAt: status === "completed" ? new Date() : null },
      { new: true }
    );

    if (!donation) return res.status(404).json({ message: "Donation not found" });

    res.json({ message: "Donation status updated successfully", donation });
  } catch (error) {
    console.error("Update Donation Status Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ======================== DASHBOARD STATS ========================

// GET /api/admin/dashboard/stats
exports.getDashboardStats = async (req, res) => {
  try {
    const [totalAlumni, approvedAlumni, pendingAlumni, adminAlumni, completedDonations, pendingDonations] =
      await Promise.all([
        Alumni.countDocuments(),
        Alumni.countDocuments({ isApproved: true }),
        Alumni.countDocuments({ isApproved: false }),
        Alumni.countDocuments({ isAdmin: true }),
        Donation.find({ status: "completed" }),
        Donation.countDocuments({ status: "pending" }),
      ]);

    res.json({
      message: "Dashboard statistics retrieved successfully",
      stats: {
        alumni: {
          total: totalAlumni,
          approved: approvedAlumni,
          pending: pendingAlumni,
          admins: adminAlumni,
        },
        donations: {
          completed: completedDonations.length,
          pending: pendingDonations,
          totalAmount: completedDonations.reduce((sum, d) => sum + d.amount, 0),
        },
      },
    });
  } catch (error) {
    console.error("Get Dashboard Stats Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};