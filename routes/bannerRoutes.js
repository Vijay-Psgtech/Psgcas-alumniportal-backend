const express = require("express");
const { authMiddleware, adminMiddleware } = require("../middleware/auth");
const bannerUpload = require("../middleware/bannerUploads");
const {
  getActiveBanner,
  getAllBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  setActiveBanner,
} = require("../controllers/Bannercontroller");

const router = express.Router();
const receiveBannerImage = (req, res, next) => {
  bannerUpload.single("backgroundImage")(req, res, (error) => {
    if (error) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message || "Could not upload banner image",
      });
    }
    return next();
  });
};

router.get("/active", getActiveBanner);
router.get("/", authMiddleware, adminMiddleware, getAllBanners);
router.post(
  "/",
  authMiddleware,
  adminMiddleware,
  receiveBannerImage,
  createBanner,
);
router.put(
  "/:id",
  authMiddleware,
  adminMiddleware,
  receiveBannerImage,
  updateBanner,
);
router.delete("/:id", authMiddleware, adminMiddleware, deleteBanner);
router.patch(
  "/:id/set-active",
  authMiddleware,
  adminMiddleware,
  setActiveBanner,
);

module.exports = router;
