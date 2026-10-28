const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
    },

    lastName: {
      type: String,
      trim: true,
    },

    email: {
      type: String,
      unique: true,
      required: true,
    },

    password: {
      type: String,
      default: null,  // ✅ Can be null for social logins
    },
    resetOtp: { type: String, select: false },
    resetOtpExpiry: { type: Date, select: false },
    resetOtpAttempts: { type: Number, default: 0, select: false },
    resetOtpSentAt: { type: Date, select: false },

    role: {
      type: String,
      enum: ["superadmin", "admin"],
      default: "admin",
    },

    department: {
      type: String, // Only for department admin
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // ✅ NEW: OAuth Fields
    googleId: {
      type: String,
      unique: true,
      sparse: true,  // Unique only when an OAuth ID is present
    },

    facebookId: {
      type: String,
      unique: true,
      sparse: true,  // Unique only when an OAuth ID is present
    },

    profileImage: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", UserSchema);