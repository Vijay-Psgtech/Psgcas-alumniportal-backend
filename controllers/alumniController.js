// backend/controllers/alumniController.js
// ✅ COMPLETE CONTROLLER FOR ALUMNI ROUTES
// Handles all alumni operations: fetch, update, stats, map data

const Alumni = require("../models/Alumni");

// ═══════════════════════════════════════════════════════════════════════════════
// ✅ GET ALL ALUMNI (Public - only approved)
// ═══════════════════════════════════════════════════════════════════════════════
const getAllAlumni = async (req, res) => {
  try {
    // Get all approved alumni
    const alumni = await Alumni.find({ isApproved: true })
      .select("-password") // Don't return password
      .sort({ firstName: 1 });

    // Extract unique departments and years for filters
    const departments = [
      ...new Set(alumni.map((a) => a.department)),
    ].filter(Boolean).sort();

    const years = [
      ...new Set(alumni.map((a) => a.graduationYear)),
    ].sort((a, b) => b - a);

    res.status(200).json({
      success: true,
      message: "Alumni directory fetched successfully",
      data: {
        alumni,
        departments,
        years,
        totalCount: alumni.length,
      },
    });
  } catch (error) {
    console.error("Error in getAllAlumni:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching alumni directory",
      error: error.message,
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// ✅ GET SINGLE ALUMNI BY ID
// ═══════════════════════════════════════════════════════════════════════════════
const getAlumniById = async (req, res) => {
  try {
    const { id } = req.params;

    const alumnus = await Alumni.findById(id)
      .select("-password")
      .exec();

    if (!alumnus) {
      return res.status(404).json({
        success: false,
        message: "Alumni not found",
      });
    }

    // Only show if approved
    if (!alumnus.isApproved) {
      return res.status(403).json({
        success: false,
        message: "This profile is not yet approved",
      });
    }

    res.status(200).json({
      success: true,
      data: alumnus,
    });
  } catch (error) {
    console.error("Error in getAlumniById:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching alumni",
      error: error.message,
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// ✅ UPDATE ALUMNI PROFILE (Protected - own profile only)
// ═══════════════════════════════════════════════════════════════════════════════
const updateAlumniProfile = async (req, res) => {
  try {
    const { id } = req.params;

    // User can only update their own profile (unless admin)
    if (req.userId !== id && !req.user?.isAdmin) {
      return res.status(403).json({
        success: false,
        message: "You can only update your own profile",
      });
    }

    // Allowed fields to update
    const allowedFields = [
      "firstName",
      "lastName",
      "phone",
      "linkedin",
      "currentCompany",
      "jobTitle",
      "city",
      "country",
    ];

    // Filter update data
    const updateData = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    // Update timestamp
    updateData.updatedAt = new Date();

    const updatedAlumnus = await Alumni.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedAlumnus) {
      return res.status(404).json({
        success: false,
        message: "Alumni not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: updatedAlumnus,
    });
  } catch (error) {
    console.error("Error in updateAlumniProfile:", error);
    res.status(400).json({
      success: false,
      message: "Error updating profile",
      error: error.message,
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// ✅ GET ALUMNI STATISTICS
// ═══════════════════════════════════════════════════════════════════════════════
const getStats = async (req, res) => {
  try {
    const totalAlumni = await Alumni.countDocuments({ isApproved: true });

    // Group by department
    const byDepartment = await Alumni.aggregate([
      { $match: { isApproved: true } },
      {
        $group: {
          _id: "$department",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Group by graduation year
    const byYear = await Alumni.aggregate([
      { $match: { isApproved: true } },
      {
        $group: {
          _id: "$graduationYear",
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
    ]);

    // Group by country
    const byCountry = await Alumni.aggregate([
      { $match: { isApproved: true } },
      {
        $group: {
          _id: "$country",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalAlumni,
        byDepartment,
        byYear,
        byCountry,
      },
    });
  } catch (error) {
    console.error("Error in getStats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching statistics",
      error: error.message,
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// ✅ GET MAP DATA (Alumni with country/city for map visualization)
// ═══════════════════════════════════════════════════════════════════════════════
const getMapData = async (req, res) => {
  try {
    const mapData = await Alumni.find({ isApproved: true })
      .select("firstName lastName country city currentCompany jobTitle")
      .exec();

    // Group by country
    const groupedByCountry = {};
    mapData.forEach((alumni) => {
      const country = alumni.country || "Unknown";
      if (!groupedByCountry[country]) {
        groupedByCountry[country] = [];
      }
      groupedByCountry[country].push(alumni);
    });

    res.status(200).json({
      success: true,
      data: {
        alumni: mapData,
        groupedByCountry,
        totalCount: mapData.length,
      },
    });
  } catch (error) {
    console.error("Error in getMapData:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching map data",
      error: error.message,
    });
  }
};

module.exports = {
  getAllAlumni,
  getAlumniById,
  updateAlumniProfile,
  getStats,
  getMapData,
};