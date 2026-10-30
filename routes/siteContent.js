const express = require("express");
const router = express.Router();
const adminAuth = require("../middleware/adminAuth");
const upload = require("../middleware/uploads");
const {
  getPublicProfiles,
  getAdminProfiles,
  createProfile,
  seedProfiles,
  updateProfile,
  deleteProfile,
  updateSectionContent,
} = require("../controllers/siteContentController");

router.get("/:type", getPublicProfiles);
router.get("/admin/:type", adminAuth, getAdminProfiles);
router.put("/admin/:type/section", adminAuth, updateSectionContent);
router.post("/admin/:type/seed", adminAuth, seedProfiles);
router.post("/admin/:type", adminAuth, upload.single("image"), createProfile);
router.put("/admin/:type/:id", adminAuth, upload.single("image"), updateProfile);
router.delete("/admin/:type/:id", adminAuth, deleteProfile);

module.exports = router;
