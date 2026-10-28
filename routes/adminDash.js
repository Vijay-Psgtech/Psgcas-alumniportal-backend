const express = require("express");
const router = express.Router();
const multer = require("multer");
const adminAuth = require("../middleware/adminAuth");
const { superAdminMiddleware } = require("../middleware/auth");
const {
  getAllAlumniForAdmin,
  getDashboardStats,
  getAllDonations,
} = require("../controllers/adminDashController");
const {
  exportPaidAlumniCsv,
  findAlumniDuplicates,
  updateAlumniByAdmin,
  deleteAlumniByAdmin,
  importPaidAlumniCsv,
} = require("../controllers/adminAlumniController");
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});
const {
  resendMembershipReceipt,
} = require("../controllers/membershipPaymentController");

// All routes protected with adminAuth middleware
router.use(adminAuth); // Protect all routes below

// Get all alumni
router.get("/alumni/all", getAllAlumniForAdmin);
router.get("/alumni/export.csv", exportPaidAlumniCsv);
router.get("/alumni/duplicates", findAlumniDuplicates);
router.post(
  "/alumni/import",
  superAdminMiddleware,
  csvUpload.single("file"),
  importPaidAlumniCsv,
);
router.put("/alumni/:id", updateAlumniByAdmin);
router.delete("/alumni/:id", deleteAlumniByAdmin);
router.post("/alumni/:id/resend-receipt", resendMembershipReceipt);

// ============ DONATION MANAGEMENT ROUTES ============
// Get all donations
router.get("/donations/all", getAllDonations);

// ============ STATISTICS ROUTE ============
// Get dashboard statistics
router.get("/stats", getDashboardStats);

module.exports = router;
