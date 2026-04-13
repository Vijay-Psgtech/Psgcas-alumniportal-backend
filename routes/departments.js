// backend/routes/departments.js
const express = require("express");
const {
  getAllDepartments,
  getDepartmentsByType,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getAllDepartmentsAdmin,
  toggleDepartmentStatus,
} = require("../controllers/departmentController");
const { authMiddleware, adminMiddleware } = require("../middleware/auth");

const router = express.Router();

// ── ADMIN ROUTES (more specific, must come first) ──
// Get all departments (including inactive) - admin only
router.get("/admin/all", authMiddleware, adminMiddleware, getAllDepartmentsAdmin);

// Create new department
router.post("/", authMiddleware, adminMiddleware, createDepartment);

// Update department
router.put("/:id", authMiddleware, adminMiddleware, updateDepartment);

// Delete department
router.delete("/:id", authMiddleware, adminMiddleware, deleteDepartment);

// Toggle department active status
router.patch("/:id/toggle", authMiddleware, adminMiddleware, toggleDepartmentStatus);

// ── PUBLIC ROUTES (less specific, come after admin routes) ──
// Get all active departments
router.get("/", getAllDepartments);

// Get departments by programme and funding type
// NOTE: This must come AFTER /admin/all to avoid route conflict
router.get("/:programmeType/:fundingType", getDepartmentsByType);

module.exports = router;