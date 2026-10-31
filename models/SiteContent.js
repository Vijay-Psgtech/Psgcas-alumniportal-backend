const mongoose = require("mongoose");

const siteContentSchema = new mongoose.Schema(
  {
    page: {
      type: String,
      enum: ["home", "leadership"],
      required: true,
      unique: true,
    },
    content: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true, collection: "sitecontent" },
);

module.exports = mongoose.model("SiteContent", siteContentSchema);