const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const uploadDirectory = path.join(__dirname, "..", "uploads", "banners");

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    fs.mkdir(uploadDirectory, { recursive: true }, (error) =>
      callback(error, uploadDirectory),
    );
  },
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${extension}`);
  },
});

module.exports = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!allowedTypes.has(file.mimetype)) {
      const error = new Error("Banner image must be a JPG, PNG, or WEBP file");
      error.status = 400;
      return callback(error);
    }
    return callback(null, true);
  },
});
