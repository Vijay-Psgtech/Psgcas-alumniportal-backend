const mongoose = require("mongoose");

const AlumniSchema = new mongoose.Schema(
  {
    alumniId: {
      type: String,
      unique: true,
      required: true,
    },
    // Basic Info
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
      select: false, // Don't return password by default
    },
    resetOtp: { type: String, select: false },
    resetOtpExpiry: { type: Date, select: false },
    resetOtpAttempts: { type: Number, default: 0, select: false },
    resetOtpSentAt: { type: Date, select: false },
    phone: {
      type: String,
      trim: true,
    },
    rollNumber: {
      type: String,
      trim: true,
    },
    gender: {
      type: String,
      enum: ["Male", "Female", "Other"],
    },
    occupation: {
      type: String,
      trim: true,
    },

    // Education
    department: {
      type: String,
      required: [true, "Department is required"],
    },
    programmeType: {
      type: String,
      trim: true,
    },
    fundingType: {
      type: String,
      trim: true,
    },
    degree: {
      type: String,
      trim: true,
    },
    batchYear: {
      type: String,
      required: [true, "Batch year is required"],
    },
    studyStartYear: {
      type: String,
    },
    studyEndYear: {
      type: String,
    },
    batchDetails: {
      type: String,
      trim: true,
    },
    departmentDetails: {
      type: String,
      trim: true,
    },
    educationHistory: [
      {
        department: { type: String, trim: true, default: "" },
        degree: { type: String, trim: true, default: "" },
        studyStartYear: { type: String, trim: true, default: "" },
        studyEndYear: { type: String, trim: true, default: "" },
      },
    ],

    // Employment
    currentCompany: {
      type: String,
      trim: true,
    },
    jobTitle: {
      type: String,
      trim: true,
    },
    industry: {
      type: String,
      trim: true,
    },
    officeContact: {
      type: String,
      trim: true,
    },
    officeAddress: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      pincode: String,
      country: String,
    },

    // Social Links
    social: {
      linkedin: String,
      twitter: String,
      instagram: String,
      facebook: String,
      website: String,
    },

    // Location Information (for Alumni Map)
    country: {
      type: String,
    },
    city: {
      type: String,
    },

    fullAddress: {
      type: String,
    },

    postalAddress: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      pincode: String,
      country: String,
    },

    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: [] }, // [lng, lat]
    },

    // Files Upload
    files: {
      businessCard: {
        type: String,
      },

      idCard: {
        type: String,
      },

      entrepreneurPoster: {
        type: String,
      },

      studentPhoto: {
        type: String,
      },

      currentPhoto: {
        type: String,
      },
    },

    // Status
    isApproved: {
      type: Boolean,
      default: false, // New registrations pending approval
    },
    membershipPayment: {
      status: {
        type: String,
        enum: ["paid"],
      },
      amount: Number,
      currency: { type: String, default: "INR" },
      provider: String,
      transactionId: { type: String, sparse: true, unique: true },
      receiptNumber: { type: String, sparse: true, unique: true },
      transactionDate: Date,
      receiptEmailStatus: {
        type: String,
        enum: ["pending", "sent", "failed", "imported"],
        default: "pending",
      },
      receiptEmailError: String,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },

    profileImage: { type: String },

    role : {
      type: String,
      enum: ['Alumni', 'Faculty', 'Student', 'Admin'],
      default: 'Alumni'
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
  },
);

AlumniSchema.index({ location: "2dsphere" }); // Geospatial index for location
AlumniSchema.index({ batchYear: 1 });
AlumniSchema.index({ department: 1 });
AlumniSchema.index({ isApproved: 1 }); // Index for filtering approved alumni

module.exports = mongoose.model("Alumni", AlumniSchema);
