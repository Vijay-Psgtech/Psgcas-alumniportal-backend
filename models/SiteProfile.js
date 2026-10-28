const mongoose = require("mongoose");

const siteProfileSchema = new mongoose.Schema(
  {
    contentType: {
      type: String,
      enum: ["notable-alumni", "leadership"],
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    role: { type: String, trim: true, default: "" },
    rank: { type: String, trim: true, default: "" },
    note: { type: String, trim: true, default: "" },
    bio: { type: String, trim: true, default: "" },
    title: { type: String, trim: true, default: "" },
    company: { type: String, trim: true, default: "" },
    location: { type: String, trim: true, default: "" },
    batch: { type: String, trim: true, default: "" },
    degree: { type: String, trim: true, default: "" },
    category: { type: String, trim: true, default: "" },
    achievement: { type: String, trim: true, default: "" },
    image: { type: String, trim: true, default: "" },
    sortOrder: { type: Number, default: 0 },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true },
);

siteProfileSchema.index({ contentType: 1, sortOrder: 1 });

module.exports = mongoose.model("SiteProfile", siteProfileSchema);
