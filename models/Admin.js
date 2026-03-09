// backend/models/Admin.js
const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema(
  {
    // Admin Email (unique identifier)
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, "Please enter a valid email"],
    },
    
    // Admin Password (hashed)
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
      select: false, // Don't return password by default in queries
    },
    
    // Admin Full Name
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },
    
    // Admin Role/Title
    role: {
      type: String,
      enum: ["super_admin", "moderator"],
      default: "moderator",
    },
    
    // Permissions
    permissions: {
      manageAlumni: {
        type: Boolean,
        default: true,
      },
      manageDonations: {
        type: Boolean,
        default: true,
      },
      makeAdmin: {
        type: Boolean,
        default: false, // Only super admin can make other admins
      },
      viewAnalytics: {
        type: Boolean,
        default: true,
      },
    },
    
    // Last Login Timestamp
    lastLogin: {
      type: Date,
      default: null,
    },
    
    // Account Status
    isActive: {
      type: Boolean,
      default: true,
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
    timestamps: true,
  }
);

// ✅ FIXED: unique: true already creates an index, so we don't need schema.index()
// Removed: adminSchema.index({ email: 1 });

module.exports = mongoose.model("Admin", adminSchema);