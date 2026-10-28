const SiteProfile = require("../models/SiteProfile");
const SiteContentSection = require("../models/SiteContentSection");

const validTypes = new Set(["notable-alumni", "leadership"]);
const editableFields = [
  "name",
  "role",
  "rank",
  "note",
  "bio",
  "title",
  "company",
  "location",
  "batch",
  "degree",
  "category",
  "achievement",
  "image",
  "sortOrder",
  "enabled",
];

const validateType = (type) => validTypes.has(type);

exports.getPublicProfiles = async (req, res) => {
  if (!validateType(req.params.type)) {
    return res.status(400).json({ message: "Invalid site content type" });
  }
  try {
    const [profiles, section] = await Promise.all([
      SiteProfile.find({
        contentType: req.params.type,
        enabled: true,
      }).sort({ sortOrder: 1, name: 1 }),
      SiteContentSection.findOne({ contentType: req.params.type }).lean(),
    ]);
    return res.json({
      profiles,
      managed: Boolean(section) || profiles.length > 0,
      section: section || { title: "", description: "" },
    });
  } catch (error) {
    console.error("Site content fetch failed:", error);
    return res.status(500).json({ message: "Failed to fetch site content" });
  }
};

exports.getAdminProfiles = async (req, res) => {
  if (!validateType(req.params.type)) {
    return res.status(400).json({ message: "Invalid site content type" });
  }
  try {
    const [profiles, section] = await Promise.all([
      SiteProfile.find({
        contentType: req.params.type,
      }).sort({ sortOrder: 1, name: 1 }),
      SiteContentSection.findOne({ contentType: req.params.type }).lean(),
    ]);
    return res.json({
      profiles,
      managed: Boolean(section) || profiles.length > 0,
      section: section || { title: "", description: "" },
    });
  } catch (error) {
    console.error("Admin site content fetch failed:", error);
    return res.status(500).json({ message: "Failed to fetch site content" });
  }
};

exports.updateSectionContent = async (req, res) => {
  if (!validateType(req.params.type)) {
    return res.status(400).json({ message: "Invalid site content type" });
  }
  const { title, description, replaceProfiles } = req.body;
  if (
    (title !== undefined && typeof title !== "string") ||
    (description !== undefined && typeof description !== "string") ||
    (replaceProfiles !== undefined && typeof replaceProfiles !== "boolean")
  ) {
    return res.status(400).json({ message: "Title and description must be text" });
  }
  try {
    const section = await SiteContentSection.findOneAndUpdate(
      { contentType: req.params.type },
      {
        $set: {
          ...(title !== undefined ? { title: title.trim() } : {}),
          ...(description !== undefined
            ? { description: description.trim() }
            : {}),
          ...(replaceProfiles !== undefined ? { replaceProfiles } : {}),
          managed: true,
        },
        $setOnInsert: { contentType: req.params.type },
      },
      { new: true, upsert: true, runValidators: true },
    );
    return res.json({ section });
  } catch (error) {
    console.error("Admin site section update failed:", error);
    return res.status(400).json({
      message: error.message || "Failed to update site content",
    });
  }
};

exports.createProfile = async (req, res) => {
  if (!validateType(req.params.type)) {
    return res.status(400).json({ message: "Invalid site content type" });
  }
  try {
    const profileData = Object.fromEntries(
      Object.entries(req.body).filter(([field]) => editableFields.includes(field)),
    );
    if (req.file) profileData.image = req.file.path.replace(/\\/g, "/");
    if (!profileData.name?.trim()) {
      return res.status(400).json({ message: "Profile name is required" });
    }
    await SiteContentSection.updateOne(
      { contentType: req.params.type },
      { $setOnInsert: { managed: true } },
      { upsert: true },
    );
    const profile = await SiteProfile.create({
      ...profileData,
      contentType: req.params.type,
    });
    return res.status(201).json({ profile });
  } catch (error) {
    console.error("Admin site profile creation failed:", error);
    return res.status(400).json({ message: error.message || "Failed to create profile" });
  }
};

exports.seedProfiles = async (req, res) => {
  if (!validateType(req.params.type)) {
    return res.status(400).json({ message: "Invalid site content type" });
  }
  try {
    if (!Array.isArray(req.body.profiles) || !req.body.profiles.length) {
      return res.status(400).json({ message: "Seed profiles are required" });
    }
    if (await SiteProfile.exists({ contentType: req.params.type })) {
      return res.status(409).json({
        message: "Managed profiles already exist for this section",
      });
    }
    const profiles = req.body.profiles.map((profile) => {
      const values = Object.fromEntries(
        Object.entries(profile).filter(([field]) => editableFields.includes(field)),
      );
      if (!values.name?.trim()) {
        throw new Error("Every profile must have a name");
      }
      return { ...values, contentType: req.params.type };
    });
    const created = await SiteProfile.insertMany(profiles, { ordered: true });
    await SiteContentSection.updateOne(
      { contentType: req.params.type },
      { $set: { managed: true } },
      { upsert: true },
    );
    return res.status(201).json({
      message: "Existing section content copied into managed profiles",
      count: created.length,
    });
  } catch (error) {
    console.error("Site content seed failed:", error);
    return res.status(400).json({ message: error.message || "Failed to seed profiles" });
  }
};

exports.updateProfile = async (req, res) => {
  if (!validateType(req.params.type)) {
    return res.status(400).json({ message: "Invalid site content type" });
  }
  try {
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([field]) => editableFields.includes(field)),
    );
    if (req.file) updates.image = req.file.path.replace(/\\/g, "/");
    const profile = await SiteProfile.findOneAndUpdate(
      { _id: req.params.id, contentType: req.params.type },
      updates,
      { new: true, runValidators: true },
    );
    if (!profile) return res.status(404).json({ message: "Profile not found" });
    return res.json({ profile });
  } catch (error) {
    console.error("Admin site profile update failed:", error);
    return res.status(400).json({ message: error.message || "Failed to update profile" });
  }
};

exports.deleteProfile = async (req, res) => {
  if (!validateType(req.params.type)) {
    return res.status(400).json({ message: "Invalid site content type" });
  }
  try {
    const profile = await SiteProfile.findOneAndDelete({
      _id: req.params.id,
      contentType: req.params.type,
    });
    if (!profile) return res.status(404).json({ message: "Profile not found" });
    return res.json({ message: "Profile deleted successfully" });
  } catch (error) {
    console.error("Admin site profile deletion failed:", error);
    return res.status(500).json({ message: "Failed to delete profile" });
  }
};
