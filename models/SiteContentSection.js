const mongoose = require("mongoose");

const siteContentSectionSchema = new mongoose.Schema(
  {
    contentType: {
      type: String,
      enum: ["notable-alumni", "leadership"],
      required: true,
      unique: true,
    },
    managed: { type: Boolean, default: true },
    title: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
    replaceProfiles: { type: Boolean, default: false },
  },
  { timestamps: true },
);

module.exports = mongoose.model("SiteContentSection", siteContentSectionSchema);
