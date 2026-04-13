// backend/controllers/subAdminController.js
// ✅ FIXED: createSubAdmin and promoteAlumniToSubAdmin now set isSubAdmin: true
// ✅ FIXED: revokeSubAdmin clears isSubAdmin flag
// ✅ FIXED: Department alumni filter uses department name match correctly

const Alumni = require("../models/Alumni");
const Department = require("../models/Department");
const bcrypt = require("bcryptjs");

// ─────────────────────────────────────────────────────────────────────────────
// SUPER ADMIN: List all sub-admins
// GET /api/sub-admin/all
// ─────────────────────────────────────────────────────────────────────────────
exports.getAllSubAdmins = async (req, res) => {
  try {
    const subAdmins = await Alumni.find({ role: "subAdmin" })
      .select("-password")
      .populate("assignedDepartment", "name degree programmeType fundingType")
      .sort("-createdAt");

    res.json({
      success: true,
      data: { subAdmins, total: subAdmins.length },
    });
  } catch (error) {
    console.error("Get All SubAdmins Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SUPER ADMIN: Create a sub-admin account (fresh, not from existing alumni)
// POST /api/sub-admin/create
// Body: { firstName, lastName, email, password, departmentId }
// ─────────────────────────────────────────────────────────────────────────────
exports.createSubAdmin = async (req, res) => {
  try {
    const { firstName, lastName, email, password, departmentId } = req.body;

    if (!firstName || !lastName || !email || !password || !departmentId) {
      return res.status(400).json({
        success: false,
        message: "firstName, lastName, email, password, and departmentId are all required",
      });
    }

    const department = await Department.findById(departmentId);
    if (!department) {
      return res.status(404).json({ success: false, message: "Department not found" });
    }

    const existing = await Alumni.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
    const alumniId = `SA-${timestamp}-${randomStr}`;

    const subAdmin = new Alumni({
      alumniId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      department: department.name,
      batchYear: new Date().getFullYear().toString(),
      location: { type: "Point", coordinates: [0, 0] },

      // ✅ FIXED: Set both role AND isSubAdmin
      role: "subAdmin",
      isSubAdmin: true,           // ← Added: frontend checks this field too
      assignedDepartment: departmentId,
      isApproved: true,           // Sub-admins are pre-approved
      isAdmin: false,

      degree: department.degree || "N/A",
      programmeType: department.programmeType || "N/A",
      graduationYear: new Date().getFullYear(),
      studyStartYear: new Date().getFullYear().toString(),
      studyEndYear: new Date().getFullYear().toString(),
    });

    await subAdmin.save();
    await subAdmin.populate("assignedDepartment", "name degree programmeType fundingType");

    const result = subAdmin.toObject();
    delete result.password;

    res.status(201).json({
      success: true,
      message: "Sub-admin account created successfully",
      data: { subAdmin: result },
    });
  } catch (error) {
    console.error("Create SubAdmin Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SUPER ADMIN: Promote an existing alumni to sub-admin
// PUT /api/sub-admin/promote/:alumniId
// Body: { departmentId }
// ─────────────────────────────────────────────────────────────────────────────
exports.promoteAlumniToSubAdmin = async (req, res) => {
  try {
    const { alumniId } = req.params;
    const { departmentId } = req.body;

    if (!departmentId) {
      return res.status(400).json({ success: false, message: "departmentId is required" });
    }

    const department = await Department.findById(departmentId);
    if (!department) {
      return res.status(404).json({ success: false, message: "Department not found" });
    }

    const alumni = await Alumni.findById(alumniId);
    if (!alumni) {
      return res.status(404).json({ success: false, message: "Alumni not found" });
    }

    if (alumni.isAdmin) {
      return res.status(400).json({
        success: false,
        message: "Cannot demote a super-admin to sub-admin",
      });
    }

    // ✅ FIXED: Set both role AND isSubAdmin
    alumni.role = "subAdmin";
    alumni.isSubAdmin = true;     // ← Added
    alumni.assignedDepartment = departmentId;
    alumni.isApproved = true;
    await alumni.save();
    await alumni.populate("assignedDepartment", "name degree programmeType fundingType");

    const result = alumni.toObject();
    delete result.password;

    res.json({
      success: true,
      message: `${alumni.firstName} ${alumni.lastName} has been promoted to sub-admin for ${department.name}`,
      data: { subAdmin: result },
    });
  } catch (error) {
    console.error("Promote SubAdmin Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SUPER ADMIN: Update sub-admin (reassign department or toggle active status)
// PUT /api/sub-admin/:id
// Body: { departmentId?, isActive? }
// ─────────────────────────────────────────────────────────────────────────────
exports.updateSubAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { departmentId, isActive } = req.body;

    const subAdmin = await Alumni.findOne({ _id: id, role: "subAdmin" });
    if (!subAdmin) {
      return res.status(404).json({ success: false, message: "Sub-admin not found" });
    }

    if (departmentId) {
      const department = await Department.findById(departmentId);
      if (!department) {
        return res.status(404).json({ success: false, message: "Department not found" });
      }
      subAdmin.assignedDepartment = departmentId;
      // Keep department name in sync
      subAdmin.department = department.name;
    }

    if (typeof isActive === "boolean") {
      subAdmin.isApproved = isActive;
    }

    await subAdmin.save();
    await subAdmin.populate("assignedDepartment", "name degree programmeType fundingType");

    const result = subAdmin.toObject();
    delete result.password;

    res.json({
      success: true,
      message: "Sub-admin updated successfully",
      data: { subAdmin: result },
    });
  } catch (error) {
    console.error("Update SubAdmin Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SUPER ADMIN: Revoke sub-admin access (demote back to alumni)
// DELETE /api/sub-admin/:id
// ─────────────────────────────────────────────────────────────────────────────
exports.revokeSubAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const subAdmin = await Alumni.findOne({ _id: id, role: "subAdmin" });
    if (!subAdmin) {
      return res.status(404).json({ success: false, message: "Sub-admin not found" });
    }

    // ✅ FIXED: Clear both role AND isSubAdmin on revoke
    subAdmin.role = "alumni";
    subAdmin.isSubAdmin = false;  // ← Added
    subAdmin.assignedDepartment = undefined;
    await subAdmin.save();

    res.json({
      success: true,
      message: `Sub-admin access revoked. ${subAdmin.firstName} ${subAdmin.lastName} is now a regular alumni.`,
    });
  } catch (error) {
    console.error("Revoke SubAdmin Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Build a department-scoped filter
// Matches alumni whose `department` string matches the department's name.
// This works for alumni who registered before sub-admin assignment existed.
// ─────────────────────────────────────────────────────────────────────────────
const buildDeptFilter = (departmentId, deptName) => ({
  $or: [
    { assignedDepartment: departmentId },
    { department: deptName },
  ],
  role: { $ne: "subAdmin" },
  isAdmin: false,
});

// ─────────────────────────────────────────────────────────────────────────────
// SUB-ADMIN: Get their own department's alumni (pending + approved)
// GET /api/sub-admin/my-department/alumni
// Query: ?status=pending|approved|all (default: all)
// ─────────────────────────────────────────────────────────────────────────────
exports.getDepartmentAlumni = async (req, res) => {
  try {
    const { status = "all" } = req.query;

    // assignedDepartment is populated by authMiddleware
    const assignedDept = req.user.assignedDepartment;
    if (!assignedDept) {
      return res.status(403).json({
        success: false,
        message: "No department assigned to your account. Contact super admin.",
      });
    }

    const departmentId = assignedDept._id || assignedDept;
    const deptDoc = await Department.findById(departmentId);
    if (!deptDoc) {
      return res.status(404).json({ success: false, message: "Assigned department not found" });
    }

    const filter = buildDeptFilter(departmentId, deptDoc.name);
    if (status === "pending") filter.isApproved = false;
    else if (status === "approved") filter.isApproved = true;

    const alumni = await Alumni.find(filter).select("-password").sort("-createdAt");

    res.json({
      success: true,
      data: {
        department: deptDoc,
        alumni,
        total: alumni.length,
        pending: alumni.filter((a) => !a.isApproved).length,
        approved: alumni.filter((a) => a.isApproved).length,
      },
    });
  } catch (error) {
    console.error("Get Department Alumni Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SUB-ADMIN: Approve an alumni (must belong to their department)
// PUT /api/sub-admin/my-department/alumni/:alumniId/approve
// ─────────────────────────────────────────────────────────────────────────────
exports.approveDepartmentAlumni = async (req, res) => {
  try {
    const { alumniId } = req.params;
    const departmentId = req.user.assignedDepartment?._id || req.user.assignedDepartment;
    const deptDoc = await Department.findById(departmentId);

    const alumni = await Alumni.findOne({
      _id: alumniId,
      ...buildDeptFilter(departmentId, deptDoc?.name),
    });

    if (!alumni) {
      return res.status(404).json({
        success: false,
        message: "Alumni not found in your department",
      });
    }

    if (alumni.isApproved) {
      return res.status(400).json({
        success: false,
        message: "Alumni is already approved",
      });
    }

    alumni.isApproved = true;
    await alumni.save();

    const result = alumni.toObject();
    delete result.password;

    res.json({
      success: true,
      message: `${alumni.firstName} ${alumni.lastName} has been approved`,
      data: { alumni: result },
    });
  } catch (error) {
    console.error("Approve Department Alumni Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SUB-ADMIN: Reject (delete) an alumni (must belong to their department)
// DELETE /api/sub-admin/my-department/alumni/:alumniId/reject
// ─────────────────────────────────────────────────────────────────────────────
exports.rejectDepartmentAlumni = async (req, res) => {
  try {
    const { alumniId } = req.params;
    const departmentId = req.user.assignedDepartment?._id || req.user.assignedDepartment;
    const deptDoc = await Department.findById(departmentId);

    const alumni = await Alumni.findOne({
      _id: alumniId,
      ...buildDeptFilter(departmentId, deptDoc?.name),
    });

    if (!alumni) {
      return res.status(404).json({
        success: false,
        message: "Alumni not found in your department",
      });
    }

    const name = `${alumni.firstName} ${alumni.lastName}`;
    await Alumni.findByIdAndDelete(alumniId);

    res.json({
      success: true,
      message: `${name}'s registration has been rejected and removed`,
    });
  } catch (error) {
    console.error("Reject Department Alumni Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SUB-ADMIN: View a single alumni profile (department-scoped)
// GET /api/sub-admin/my-department/alumni/:alumniId
// ─────────────────────────────────────────────────────────────────────────────
exports.getDepartmentAlumniById = async (req, res) => {
  try {
    const { alumniId } = req.params;
    const departmentId = req.user.assignedDepartment?._id || req.user.assignedDepartment;
    const deptDoc = await Department.findById(departmentId);

    const alumni = await Alumni.findOne({
      _id: alumniId,
      ...buildDeptFilter(departmentId, deptDoc?.name),
    }).select("-password");

    if (!alumni) {
      return res.status(404).json({
        success: false,
        message: "Alumni not found in your department",
      });
    }

    res.json({ success: true, data: { alumni } });
  } catch (error) {
    console.error("Get Department Alumni By Id Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SUB-ADMIN: Get stats for their own department
// GET /api/sub-admin/my-department/stats
// ─────────────────────────────────────────────────────────────────────────────
exports.getDepartmentStats = async (req, res) => {
  try {
    const departmentId = req.user.assignedDepartment?._id || req.user.assignedDepartment;
    const deptDoc = await Department.findById(departmentId);

    if (!deptDoc) {
      return res.status(404).json({ success: false, message: "Assigned department not found" });
    }

    const baseFilter = buildDeptFilter(departmentId, deptDoc.name);

    const [total, pending, approved] = await Promise.all([
      Alumni.countDocuments(baseFilter),
      Alumni.countDocuments({ ...baseFilter, isApproved: false }),
      Alumni.countDocuments({ ...baseFilter, isApproved: true }),
    ]);

    // Batch breakdown for this department
    const batchBreakdown = await Alumni.aggregate([
      { $match: { ...baseFilter, isApproved: true } },
      { $group: { _id: "$graduationYear", count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
      { $limit: 10 },
    ]);

    res.json({
      success: true,
      data: {
        department: deptDoc,
        stats: {
          total,
          pending,
          approved,
          batchBreakdown,
        },
      },
    });
  } catch (error) {
    console.error("Get Department Stats Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};