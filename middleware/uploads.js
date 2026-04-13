const multer = require("multer");
const path = require("path");
const fs = require("fs");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let folder = "uploads/";

    if (req.baseUrl.includes("event")) {
      folder += "events/";
    } else if (req.baseUrl.includes("alumni")) {
      folder += "alumniProfile/";
    } else if (req.baseUrl.includes("albums")) {
      folder += "albums/";
    } else if (req.baseUrl.includes("newsletters")) {
      folder += "newsletters/";
    } else {
      folder += "others/";
    }

    // create folder if not exsits
    fs.mkdirSync(folder, { recursive: true });

    cb(null, folder);
  },

  filename: function (req, file, cb) {
    const uniqueName =
      Date.now() + "-" + file.originalname.replace(/\s+/g, "-");
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/jpg"];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

module.exports = upload;
