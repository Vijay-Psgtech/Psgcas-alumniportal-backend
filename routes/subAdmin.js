// backend/routes/subAdmin.js
const express = require("express");
const {
  getAllSubAdmins,
  createSubAdmin,
  promoteAlumniToSubAdmin,
  updateSubAdmin,
  revokeSubAdmin,
  getDepartmentAlumni,
  approveDepartmentAlumni,
  rejectDepartmentAlumni,
  getDepartmentAlumniById,
  getDepartmentStats,
} = require("../controllers/subAdminController");

const { authMiddleware, adminMiddleware, subAdminMiddleware } = require("../middleware/auth");

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// SUPER ADMIN ROUTES — manage sub-admins
// All require: valid JWT + isAdmin flag
// ─────────────────────────────────────────────────────────────────────────────

// GET  /api/sub-admin/all             → list all sub-admins
router.get("/all", authMiddleware, adminMiddleware, getAllSubAdmins);

// POST /api/sub-admin/create          → create a fresh sub-admin account
router.post("/create", authMiddleware, adminMiddleware, createSubAdmin);

// PUT  /api/sub-admin/promote/:alumniId → promote existing alumni to sub-admin
router.put("/promote/:alumniId", authMiddleware, adminMiddleware, promoteAlumniToSubAdmin);

// PUT  /api/sub-admin/:id             → update sub-admin (reassign dept / toggle active)
router.put("/:id", authMiddleware, adminMiddleware, updateSubAdmin);

// DELETE /api/sub-admin/:id           → revoke sub-admin access (demote to alumni)
router.delete("/:id", authMiddleware, adminMiddleware, revokeSubAdmin);

// ─────────────────────────────────────────────────────────────────────────────
// SUB-ADMIN SCOPED ROUTES — sub-admin's own operations
// Require: valid JWT + role === 'subAdmin' + assignedDepartment set
// subAdminMiddleware enforces this and populates req.user.assignedDepartment
//
// ⚠️ IMPORTANT: More specific routes MUST come BEFORE generic ones!
// Otherwise "/alumni" will catch "/alumni/:alumniId"
// ─────────────────────────────────────────────────────────────────────────────

// 🔴 SPECIFIC ROUTES FIRST (with parameters)
// ─────────────────────────────────────────────────────────────────────────────

// GET    /api/sub-admin/my-department/stats              → dept stats
router.get("/my-department/stats", authMiddleware, subAdminMiddleware, getDepartmentStats);

// GET    /api/sub-admin/my-department/alumni/:alumniId   → view single alumni
router.get("/my-department/alumni/:alumniId", authMiddleware, subAdminMiddleware, getDepartmentAlumniById);

// PUT    /api/sub-admin/my-department/alumni/:alumniId/approve → approve
router.put("/my-department/alumni/:alumniId/approve", authMiddleware, subAdminMiddleware, approveDepartmentAlumni);

// DELETE /api/sub-admin/my-department/alumni/:alumniId/reject  → reject
router.delete("/my-department/alumni/:alumniId/reject", authMiddleware, subAdminMiddleware, rejectDepartmentAlumni);

// 🟢 GENERIC ROUTES LAST (without parameters or after specific ones)
// ─────────────────────────────────────────────────────────────────────────────

// GET    /api/sub-admin/my-department/alumni             → list dept alumni
// Query: ?status=pending|approved|all
router.get("/my-department/alumni", authMiddleware, subAdminMiddleware, getDepartmentAlumni);

module.exports = router;