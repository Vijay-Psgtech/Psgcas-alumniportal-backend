// models/Alumni.js
const mongoose = require("mongoose");

const alumniSchema = new mongoose.Schema(
  {
    // Personal Information
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, "Please enter a valid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
      select: false, // Don't return password by default
    },
    phone: {
      type: String,
      trim: true,
    },
    linkedin: {
      type: String,
      trim: true,
    },

    // Academic Information
    department: {
      type: String,
      required: [true, "Department is required"],
    },
    graduationYear: {
      type: Number,
      required: [true, "Graduation year is required"],
    },
    rollNumber: {
      type: String,
      trim: true,
    },

    // Professional Information
    currentCompany: {
      type: String,
      trim: true,
    },
    jobTitle: {
      type: String,
      trim: true,
    },

    // Location Information (for Alumni Map)
    country: {
      type: String,
      required: [true, "Country is required"],
    },
    city: {
      type: String,
      required: [true, "City is required"],
    },

    // Status
    isApproved: {
      type: Boolean,
      default: false, // New registrations pending approval
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },

    // Timestamps
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // Automatically manage createdAt and updatedAt
  }
);

// ✅ FIXED: Remove duplicate indexes - only use schema.index()
alumniSchema.index({ isApproved: 1 });
alumniSchema.index({ country: 1, city: 1 });

module.exports = mongoose.model("Alumni", alumniSchema);