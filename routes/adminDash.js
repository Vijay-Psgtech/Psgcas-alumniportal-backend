const express = require("express");
const router = express.Router();
const adminAuth = require("../middleware/adminAuth");
const {
  getAllAlumniForAdmin,
  getDashboardStats,
  getAllDonations,
  getAllMemberships,
} = require("../controllers/adminDashController");
const { importAlumni } = require("../controllers/alumniImportController");

// All routes protected with adminAuth middleware
router.use(adminAuth); // Protect all routes below

// Get all alumni
router.get("/alumni/all", getAllAlumniForAdmin);
router.post("/alumni/import", importAlumni);

// ============ DONATION MANAGEMENT ROUTES ============
// Get all donations
router.get("/donations/all", getAllDonations);

// ============ MEMBERSHIP MANAGEMENT ROUTES ============
// Get all memberships
router.get("/memberships/all", getAllMemberships);

// ============ STATISTICS ROUTE ============
// Get dashboard statistics
router.get("/stats", getDashboardStats);

module.exports = router;
