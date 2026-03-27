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
const { alumniUpload } = require("../middleware/alumniUploads");

router.get("/", getAllAlumni);
router.get("/stats/get-stats", getStats);
router.get("/map/data", getMapData);
router.get("/:id", getAlumniById);
router.put(
  "/:id",
  authMiddleware,
  alumniUpload,
  updateAlumniProfile,
);

module.exports = router;
