const express = require("express");
const fs = require("fs/promises");
const SiteContent = require("../models/SiteContent");
const upload = require("../middleware/siteContentUpload");
const {
  authMiddleware,
  superAdminMiddleware,
} = require("../middleware/auth");

const router = express.Router();
const allowedPages = new Set(["home", "leadership"]);

router.get("/:page", async (req, res) => {
  try {
    if (!allowedPages.has(req.params.page)) {
      return res.status(404).json({ success: false, message: "Page not found" });
    }

    const page = await SiteContent.findOne({ page: req.params.page }).lean();
    return res.json({ success: true, data: page?.content || null });
  } catch (error) {
    console.error("Error fetching site content:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post(
  "/bootstrap",
  authMiddleware,
  superAdminMiddleware,
  async (req, res) => {
    try {
      const { pages } = req.body;
      if (!pages || typeof pages !== "object" || Array.isArray(pages)) {
        return res.status(400).json({ success: false, message: "Pages are required" });
      }

      for (const [page, content] of Object.entries(pages)) {
        if (!allowedPages.has(page) || !content || typeof content !== "object" || Array.isArray(content)) {
          return res.status(400).json({ success: false, message: "Invalid page content" });
        }

        await SiteContent.updateOne(
          { page },
          {
            $setOnInsert: {
              page,
              content,
              updatedBy: req.user.id,
            },
          },
          { upsert: true, runValidators: true },
        );
      }

      const documents = await SiteContent.find({ page: { $in: [...allowedPages] } }).lean();
      const data = Object.fromEntries(documents.map(({ page, content }) => [page, content]));
      return res.json({ success: true, data });
    } catch (error) {
      console.error("Error bootstrapping site content:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  },
);

router.put(
  "/:page",
  authMiddleware,
  superAdminMiddleware,
  (req, res, next) => {
    upload.array("images", 30)(req, res, (error) => {
      if (error) {
        return res.status(error.status || 400).json({
          success: false,
          message: error.message,
        });
      }
      return next();
    });
  },
  async (req, res) => {
    const uploadedFiles = req.files || [];
    const removeUploadedFiles = async () => {
      await Promise.all(
        uploadedFiles.map((file) =>
          fs.unlink(file.path).catch((unlinkError) => {
            if (unlinkError.code !== "ENOENT") {
              console.error("Failed to remove an unused site-content image:", unlinkError);
            }
          }),
        ),
      );
    };
    try {
      if (!allowedPages.has(req.params.page)) {
        await removeUploadedFiles();
        return res.status(404).json({ success: false, message: "Page not found" });
      }

      let content;
      let imageFields;
      try {
        content = JSON.parse(req.body.content);
        imageFields = JSON.parse(req.body.imageFields || "[]");
      } catch {
        await removeUploadedFiles();
        return res.status(400).json({ success: false, message: "Invalid page content payload" });
      }

      if (!content || typeof content !== "object" || Array.isArray(content)) {
        await removeUploadedFiles();
        return res.status(400).json({ success: false, message: "Page content must be an object" });
      }
      if (!Array.isArray(imageFields) || imageFields.length !== uploadedFiles.length) {
        await removeUploadedFiles();
        return res.status(400).json({ success: false, message: "Each uploaded image must have a content field" });
      }

      const allowedImageCollections = {
        profiles: (value) => value.profiles,
        "notable.alumni": (value) => value.notable?.alumni,
        "welcome.leaders": (value) => value.welcome?.leaders,
        hero: (value) => [value.hero],
      };
      for (const [index, imageField] of imageFields.entries()) {
        const collection = allowedImageCollections[imageField?.collection]?.(content);
        const record = collection?.find(
          (item) => String(item?.id ?? "hero") === String(imageField.recordId),
        );
        const field = imageField.collection === "hero" ? "backgroundImage" : "image";
        if (!record || imageField.field !== field) {
          await removeUploadedFiles();
          return res.status(400).json({ success: false, message: "Invalid image content reference" });
        }
        record[field] = `/uploads/site-content/${uploadedFiles[index].filename}`;
      }

      const page = await SiteContent.findOneAndUpdate(
        { page: req.params.page },
        {
          $set: {
            content,
            updatedBy: req.user.id,
          },
        },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
      );

      return res.json({ success: true, data: page.content });
    } catch (error) {
      await removeUploadedFiles();
      console.error("Error updating site content:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  },
);

module.exports = router;