const Alumni = require("../models/Alumni");
const Donation = require("../models/Donation");

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
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { currentCompany: { $regex: search, $options: "i" } },
      ];
    }

    let sortOptions = { createdAt: -1 };
    if (sortBy === "name") sortOptions = { firstName: 1, lastName: 1 };
    else if (sortBy === "email") sortOptions = { email: 1 };
    else if (sortBy === "year") sortOptions = { graduationYear: -1 };

    const alumni = await Alumni.find(filter)
      .select("-password")
      .sort(sortOptions);

    res.json({
      message: "Alumni retrieved successfully",
      count: alumni.length,
      alumni,
    });
  } catch (error) {
    console.error("Get All Alumni Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// GET /api/admin/dashboard/stats
exports.getDashboardStats = async (req, res) => {
  try {
    const [
      totalAlumni,
      approvedAlumni,
      pendingAlumni,
      adminAlumni,
      completedDonations,
      pendingDonations,
    ] = await Promise.all([
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
        totalAlumni: totalAlumni || 0,
        approvedAlumni: approvedAlumni || 0,
        pendingAlumni: pendingAlumni || 0,
        adminAlumni: adminAlumni || 0,
        completedDonations: completedDonations.length || 0,
        totalDonatedAmount: completedDonations.reduce(
          (sum, d) => sum + d.amount,
          0,
        ),
        pendingDonations: pendingDonations || 0,
      },
    });
  } catch (error) {
    console.error("Get Dashboard Stats Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
