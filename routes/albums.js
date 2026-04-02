const express = require("express");
const router = express.Router();
const {
  getAllAlbum,
  getAlbumByYear,
  createAlbum,
  updateAlbum,
  deleteAlbum,
} = require("../controllers/albumController");

router.get("/", getAllAlbum);
router.get("/year/:year", getAlbumByYear);
router.post("/", createAlbum);
router.put("/:id", updateAlbum);
router.delete("/:id", deleteAlbum);

module.exports = router;
