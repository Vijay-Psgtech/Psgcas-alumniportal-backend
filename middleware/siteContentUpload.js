const crypto = require("crypto");
const fs = require("fs");
const multer = require("multer");
const path = require("path");

const uploadDirectory = path.resolve(__dirname, "..", "uploads", "site-content");
const extensionByMimeType = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const upload = multer({
  storage: multer.diskStorage({
    destination(_req, _file, callback) {
      fs.mkdirSync(uploadDirectory, { recursive: true });
      callback(null, uploadDirectory);
    },
    filename(_req, file, callback) {
      callback(null, `${crypto.randomUUID()}${extensionByMimeType[file.mimetype]}`);
    },
  }),
  fileFilter(_req, file, callback) {
    if (!extensionByMimeType[file.mimetype]) {
      const error = new Error("Only JPG, PNG, and WebP images are allowed");
      error.status = 400;
      return callback(error);
    }
    return callback(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024, files: 30 },
});

module.exports = upload;
