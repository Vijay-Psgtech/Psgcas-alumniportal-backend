const express = require("express");
const router = express.Router();
const {
  getAllAlumni,
  getAlumniById,
  updateAlumniProfile,
  getStats,
  getMapData,
} = require("../controllers/alumniController");
const { authMiddleware } = require("../middleware/auth");

router.get("/", getAllAlumni);
router.get("/stats/get-stats", getStats);
router.get("/map/data", getMapData);
router.get("/:id", getAlumniById);
router.put("/:id", authMiddleware, updateAlumniProfile);

module.exports = router;
