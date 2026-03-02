const express = require("express");
const router = express.Router();
const adminAuth = require("../middleware/adminAuth");
const { getAllAlumniForAdmin, getDashboardStats } = require("../controllers/adminDashController");

// All routes protected with adminAuth middleware
router.use(adminAuth); // Protect all routes below

// Get all alumni
router.get("/alumni/all", getAllAlumniForAdmin);

// Get dashboard statistics
router.get("/stats", getDashboardStats);

module.exports = router;