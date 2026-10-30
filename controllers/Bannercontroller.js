const Banner = require("../models/Banner");
<<<<<<< ours
const fs = require("fs").promises;
const path = require("path");

=======
const fs = require("fs/promises");
const path = require("path");

const parseFeatures = (value) => {
  if (value === undefined || value === null || value === "") return [];
  const submittedValue = Array.isArray(value)
    ? [...value].reverse().find((item) => item !== "")
    : value;
  if (submittedValue === undefined || submittedValue === null || submittedValue === "") {
    return [];
  }
  const features =
    typeof submittedValue === "string"
      ? JSON.parse(submittedValue)
      : submittedValue;
  if (!Array.isArray(features)) {
    throw new Error("Banner features must be a list");
  }
  if (
    features.some(
      (feature) =>
        !feature ||
        typeof feature !== "object" ||
        Array.isArray(feature) ||
        typeof feature.text !== "string",
    )
  ) {
    throw new Error("Each banner feature must include text and an optional icon");
  }
  return features;
};

const removeUploadedImage = async (imageUrl) => {
  const prefix = "/uploads/banners/";
  if (!imageUrl?.startsWith(prefix)) return;
  const root = path.resolve(__dirname, "..", "uploads", "banners");
  const imagePath = path.resolve(root, path.basename(imageUrl));
  if (!imagePath.startsWith(`${root}${path.sep}`)) {
    throw new Error("Invalid banner image path");
  }
  try {
    await fs.unlink(imagePath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
};

const removeRequestUpload = async (req) => {
  if (!req.file?.path) return;
  try {
    await fs.unlink(req.file.path);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Could not remove unreferenced banner upload:", error);
    }
  }
};

const editableBannerFields = (body) => ({
  title: body.title?.trim(),
  description: body.description?.trim(),
  subtitle: body.subtitle?.trim() || "",
  features: parseFeatures(body.features),
  primaryButtonText: body.primaryButtonText?.trim() || "Join Now",
  secondaryButtonText: body.secondaryButtonText?.trim() || "Learn More",
});

const getRequestBody = (req) => req.body || {};

const getFailureStatus = (error) =>
  error instanceof SyntaxError ||
  error.name === "ValidationError" ||
  error.message === "Banner features must be a list" ||
  error.message === "Each banner feature must include text and an optional icon"
    ? 400
    : 500;

>>>>>>> theirs
exports.getActiveBanner = async (req, res) => {
  try {
    const banner = await Banner.findOne({ isActive: true }).select("-createdBy -__v");

    if (!banner) {
<<<<<<< ours
      return res.status(404).json({
        success: false,
        message: "No active banner found",
        data: null,
      });
=======
      return res.status(200).json({ success: true, data: null });
>>>>>>> theirs
    }

    res.status(200).json({
      success: true,
      data: banner,
    });
  } catch (error) {
<<<<<<< ours
    res.status(500).json({ success: false, message: error.message });
=======
    console.error("Active banner lookup failed:", error);
    return res.status(500).json({ success: false, message: "Failed to load active banner" });
>>>>>>> theirs
  }
};

exports.getAllBanners = async (req, res) => {
  try {
<<<<<<< ours
    const { page = 1, limit = 10, sort = "-createdAt" } = req.query;
    const skip = (page - 1) * limit;

    const banners = await Banner.find()
      .select("-__v")
      .sort(sort)
      .limit(Number(limit))
      .skip(skip);

    const total = await Banner.countDocuments();

    res.status(200).json({
      success: true,
      data: banners,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        currentPage: Number(page),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
=======
    const banners = await Banner.find()
      .select("-__v")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: banners });
  } catch (error) {
    console.error("Banner list failed:", error);
    return res.status(500).json({ success: false, message: "Failed to load banners" });
>>>>>>> theirs
  }
};

exports.getBannerById = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id).select("-__v");

    if (!banner) {
      return res.status(404).json({ success: false, message: "Banner not found" });
    }

    res.status(200).json({ success: true, data: banner });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createBanner = async (req, res) => {
  try {
<<<<<<< ours
    const { title, description, subtitle, backgroundImage, features, primaryButtonText, secondaryButtonText } = req.body;

    if (!title || !description) {
      return res.status(400).json({ success: false, message: "Title and description required" });
    }

    const banner = await Banner.create({
      title: title.trim(),
      description: description.trim(),
      subtitle: subtitle || "",
      backgroundImage: backgroundImage || "",
      features: features || [],
      primaryButtonText: primaryButtonText || "Join Now",
      secondaryButtonText: secondaryButtonText || "Learn More",
      createdBy: req.user?._id,
      isActive: !!req.body.isActive,
    });

    res.status(201).json({ success: true, data: banner });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
=======
    const body = getRequestBody(req);
    const fields = editableBannerFields(body);
    if (!fields.title || !fields.description || !req.file) {
      await removeRequestUpload(req);
      return res.status(400).json({
        success: false,
        message: "Title, description, and banner image are required",
      });
    }

    const banner = await Banner.create({
      ...fields,
      backgroundImage: `/uploads/banners/${req.file.filename}`,
      createdBy: req.user?._id,
      isActive: body.isActive === true || body.isActive === "true",
    });

    return res.status(201).json({ success: true, data: banner });
  } catch (error) {
    await removeRequestUpload(req);
    console.error("Banner creation failed:", error);
    return res.status(getFailureStatus(error)).json({
      success: false,
      message: error.message || "Failed to create banner",
    });
>>>>>>> theirs
  }
};

exports.updateBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      return res.status(404).json({ success: false, message: "Banner not found" });
    }

<<<<<<< ours
    Object.assign(banner, req.body);
    await banner.save();

    res.status(200).json({ success: true, data: banner });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
=======
    const fields = editableBannerFields(getRequestBody(req));
    for (const [field, value] of Object.entries(fields)) {
      if (value !== undefined) banner[field] = value;
    }
    const oldImage = banner.backgroundImage;
    if (req.file) banner.backgroundImage = `/uploads/banners/${req.file.filename}`;
    await banner.save();

    if (req.file && oldImage !== banner.backgroundImage) {
      try {
        await removeUploadedImage(oldImage);
      } catch (error) {
        console.error("Could not remove replaced banner image:", error);
      }
    }
    return res.status(200).json({ success: true, data: banner });
  } catch (error) {
    await removeRequestUpload(req);
    console.error("Banner update failed:", error);
    return res.status(getFailureStatus(error)).json({
      success: false,
      message: error.message || "Failed to update banner",
    });
>>>>>>> theirs
  }
};

exports.deleteBanner = async (req, res) => {
  try {
<<<<<<< ours
    const banner = await Banner.findByIdAndDelete(req.params.id);
=======
    const banner = await Banner.findById(req.params.id);
>>>>>>> theirs
    if (!banner) {
      return res.status(404).json({ success: false, message: "Banner not found" });
    }

<<<<<<< ours
    if (banner.backgroundImage?.startsWith("/uploads")) {
      const filePath = path.join(__dirname, "..", "..", banner.backgroundImage);
      await fs.unlink(filePath).catch(() => {});
    }

    res.status(200).json({ success: true, message: "Deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
=======
    await banner.deleteOne();
    try {
      await removeUploadedImage(banner.backgroundImage);
    } catch (error) {
      console.error("Banner was deleted, but its image could not be removed:", error);
    }

    return res.status(200).json({ success: true, message: "Deleted" });
  } catch (error) {
    console.error("Banner deletion failed:", error);
    return res.status(500).json({ success: false, message: "Failed to delete banner" });
>>>>>>> theirs
  }
};

exports.setActiveBanner = async (req, res) => {
  try {
<<<<<<< ours
    await Banner.updateMany({}, { isActive: false });

    const banner = await Banner.findByIdAndUpdate(
      req.params.id,
      { isActive: true },
      { new: true }
    );

=======
    const banner = await Banner.findById(req.params.id);
>>>>>>> theirs
    if (!banner) {
      return res.status(404).json({ success: false, message: "Banner not found" });
    }

<<<<<<< ours
    res.status(200).json({ success: true, data: banner });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.uploadBannerImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const imageUrl = `/uploads/banners/${req.file.filename}`;

    res.status(200).json({
      success: true,
      data: {
        imageUrl,
        filename: req.file.filename,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
=======
    await Banner.updateMany({ _id: { $ne: banner._id } }, { isActive: false });
    banner.isActive = true;
    await banner.save();
    return res.status(200).json({ success: true, data: banner });
  } catch (error) {
    console.error("Banner activation failed:", error);
    return res.status(500).json({ success: false, message: "Failed to activate banner" });
  }
};
>>>>>>> theirs
