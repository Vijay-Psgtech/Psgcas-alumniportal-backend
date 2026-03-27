const multer = require("multer");
const path = require("path");
const fs = require("fs");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/alumni");
  },

  filename: function (req, file, cb) {
    const uniqueName =
      Date.now() + "-" + Math.round(Math.random() * 1e9);

    cb(
      null,
      uniqueName + path.extname(file.originalname)
    );
  },
});

const upload = multer({ storage });

const alumniUpload = upload.fields([
  { name: "businessCard", maxCount: 1 },
  { name: "idCard", maxCount: 1 },
  { name: "entrepreneurPoster", maxCount: 1 },
  { name: "studentPhoto", maxCount: 1 },
  { name: "currentPhoto", maxCount: 1 },
]);

module.exports = { alumniUpload };
