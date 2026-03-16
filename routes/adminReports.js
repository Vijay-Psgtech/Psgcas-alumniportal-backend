const express = require("express");
const router = express.Router();
const adminAuth = require("../middleware/adminAuth");
const { getAlumniByYear } = require("../controllers/adminReportsController");

//router.use(adminAuth); // Protect all routes below

router.get("/alumni-data-by-year", getAlumniByYear);

module.exports = router;