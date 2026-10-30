const express = require("express");
const router = express.Router();
const {
  getAllAlbum,
  getAlbumByYear,
  createAlbum,
  updateAlbum,
  deleteAlbum,
} = require("../controllers/albumController");
const upload = require("../middleware/albumsUpload");
const { authMiddleware, adminMiddleware } = require("../middleware/auth");

router.get("/", getAllAlbum);
router.get("/year/:year", getAlbumByYear);
router.post("/", authMiddleware, adminMiddleware, upload.array("images", 20), createAlbum);
router.put("/:id", authMiddleware, adminMiddleware, upload.array("images", 20), updateAlbum);
router.delete("/:id", authMiddleware, adminMiddleware, deleteAlbum);

module.exports = router;
