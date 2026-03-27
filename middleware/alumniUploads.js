const multer = require("multer");
const path = require("path");
const fs = require("fs");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let folder = `uploads/alumni/${req.alumniId}/`;

    // Create folder
    fs.mkdirSync(folder, { recursive: true });

    cb(null, folder);

  },

  filename: function (req, file, cb) {
    let fileName = "";

    if (file.fieldname === "businessCard") {
      fileName = "business-card";
    } else if (file.fieldname === "idCard") {
      fileName = "id-card";
    } else if (file.fieldname === "entrepreneurPoster") {
      fileName = "entrepreneur-poster";
    } else if (file.fieldname === "studentPhoto") {
      fileName = "student-photo";
    } else if (file.fieldname === "currentPhoto") {
      fileName = "current-photo";
    }

    const ext = path.extname(file.originalname);

    cb(null, `${fileName}${ext}`);

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
