// backend/controllers/authController.js
const User = require("../models/Users");
const Alumni = require("../models/Alumni");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { transporter } = require("../config/mailer");

// In-memory OTP store: { email: { otp, expiresAt } }
// In production replace with Redis or a DB collection
const otpStore = new Map();

// ─── Helper: cookie options ──────────────────────────────────────
const COOKIE_OPTIONS = {
  httpOnly: true, // JS cannot access
  secure: process.env.NODE_ENV === "production", // HTTPS only in prod
  sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (ms)
};

// ─── Helper: generate JWT ────────────────────────────────────────
const generateToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });

// @route   POST /api/auth/register
exports.register = async (req, res) => {
  try {

    const data = JSON.parse(req.body.payload);

    const {
      firstName,
      lastName,
      email,
      password,
      phone,
      rollNumber,
      gender,
      occupation,

      department,
      programmeType,
      degree,
      batchYear,
      studyStartYear,
      studyEndYear,

      jobTitle,
      currentCompany,
      industry,
      officeContact,

      linkedin,
      twitter,
      instagram,
      facebook,
      website,

      city,
      country,
      fullAddress,
      coordinates,
      
    } = data;

    if (!firstName || !email || !password) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    const existingAlumni = await Alumni.findOne({ email: email.toLowerCase() });
    if (existingAlumni) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // File upload handling
    const files = {
      businessCard: req.files?.businessCard?.[0]
        ? `alumni/${req.alumniId}/${req.files.businessCard[0].filename}`
        : null,

      idCard: req.files?.idCard?.[0]
        ? `alumni/${req.alumniId}/${req.files.idCard[0].filename}`
        : null,

      entrepreneurPoster: req.files?.entrepreneurPoster?.[0]
        ? `alumni/${req.alumniId}/${req.files.entrepreneurPoster[0].filename}`
        : null,

      studentPhoto: req.files?.studentPhoto?.[0]
        ? `alumni/${req.alumniId}/${req.files.studentPhoto[0].filename}`
        : null,

      currentPhoto: req.files?.currentPhoto?.[0]
        ? `alumni/${req.alumniId}/${req.files.currentPhoto[0].filename}`
        : null,
    };

    // Office Address
    const officeAddress = {
      line1: data.officeAddress?.line1 || "",
      line2: data.officeAddress?.line2 || "",
      city: data.officeAddress?.city || "",
      state: data.officeAddress?.state || "",
      pincode: data.officeAddress?.pincode || "",
      country: data.officeAddress?.country || "",
    };

    // Social Links
    const social = {
      linkedin,
      twitter,
      instagram,
      facebook,
      website,
    };

    const newAlumni = new Alumni({
      alumniId : req.alumniId,
      firstName,
      lastName,
      email: email.toLowerCase(),
      password: hashedPassword,
      phone,
      rollNumber,
      gender,
      occupation,

      department,
      programmeType,
      degree,
      batchYear,
      studyStartYear,
      studyEndYear,

      
      jobTitle,
      currentCompany,
      industry,
      officeContact,
      officeAddress,

      social,

      country,
      city,
      fullAddress,
      location: {
        type: "Point",
        coordinates,
      },
      files,

      isApproved: false,
      isAdmin: false,
    });

    await newAlumni.save();

    // Issue a token so they can poll /profile for approval status
    const token = generateToken(newAlumni);

    // ── Set JWT as HttpOnly cookie ───────────────────────────────
    res.cookie("token", token, COOKIE_OPTIONS);

    res.status(201).json({
      message: "Registration successful! Waiting for admin approval.",
      alumni: {
        _id: newAlumni._id,
        firstName: newAlumni.firstName,
        lastName: newAlumni.lastName,
        email: newAlumni.email,
        isApproved: newAlumni.isApproved,
        isAdmin: newAlumni.isAdmin,
      },
    });
  } catch (error) {
    console.error("Register Error:", error);
    res
      .status(500)
      .json({ message: "Registration failed", error: error.message });
  }
};

// @route   POST /api/auth/login
// ✅ FIX: Returns 401 (not 403) for unapproved so frontend error handler works uniformly.
//         Also returns isApproved flag so frontend can show correct message.
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password required",
      });
    }

    // ===============================
    // 1. Check Admin Users First
    // ===============================
    const user = await User.findOne({
      email: email.toLowerCase(),
    }).select("+password");

    if (user) {
      const isPasswordValid = await bcrypt.compare(
        password,
        user.password
      );

      if (!isPasswordValid) {
        return res.status(401).json({
          message: "Invalid email or password",
        });
      }

      const token = generateToken({
        id: user._id,
        email: user.email,
        role: user.role,
        type: "user",
      });

      res.cookie("token", token, COOKIE_OPTIONS);

      return res.json({
        message: "Admin login successful",
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          isAdmin: true,
          isApproved: user.isActive,
        },
      });
    }

    // ===============================
    // 2. Check Alumni
    // ===============================
    const alumni = await Alumni.findOne({
      email: email.toLowerCase(),
    }).select("+password");

    if (!alumni) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      alumni.password
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const token = generateToken({
      id: alumni._id,
      email: alumni.email,
      role: "alumni",
      type: "alumni",
    });

    res.cookie("token", token, COOKIE_OPTIONS);

    res.json({
      message: alumni.isApproved
        ? "Login successful"
        : "Login successful. Awaiting admin approval.",

      user: {
        _id: alumni._id,
        firstName: alumni.firstName,
        lastName: alumni.lastName,
        email: alumni.email,
        role: "alumni",
        isApproved: alumni.isApproved,
        isAdmin: false,
      },
    });

  } catch (error) {
    console.error("Login Error:", error);

    res.status(500).json({
      message: "Login failed",
      error: error.message,
    });
  }
};

// @route   GET /api/auth/profile
// exports.getProfile = async (req, res) => {
//   try {
//     const alumni = await Alumni.findById(req.user.id).select("-password");

//     if (!alumni) {
//       return res.status(404).json({ message: "Alumni not found" });
//     }

//     res.json({ message: "Profile retrieved successfully", alumni });
//   } catch (error) {
//     console.error("Get Profile Error:", error);
//     res.status(500).json({ message: "Server error", error: error.message });
//   }
// };

exports.getProfile = async (req, res) => {
  try {
    const { id, type, role } = req.user;

    let profile;

    if (type === "user") {
      profile = await User.findById(id).select("-password");
      return res.json({
        success: true,
        user: {
          ...profile.toObject(),
          isAdmin: true,
          isApproved: profile.isActive,
        },
      });
    } else {
      profile = await Alumni.findById(id).select("-password");
      return res.json({
        success: true,
        user: {
          ...profile.toObject(),
          role: "alumni",
          isAdmin: false,
        },
      });
    }
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch profile",
    });
  }
};

// @route   PUT /api/auth/change-password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Both current and new password required" });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "New password must be at least 6 characters" });
    }

    const alumni = await Alumni.findById(req.user.id).select("+password");
    if (!alumni) {
      return res.status(404).json({ message: "Alumni not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, alumni.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    alumni.password = await bcrypt.hash(newPassword, 10);
    await alumni.save();

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Change Password Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @route   POST /api/auth/forgot-password
// ✅ NEW: Generates a 6-digit OTP and stores it (logs to console — wire up nodemailer to email it)
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const alumni = await Alumni.findOne({ email: email.toLowerCase() });
    if (!alumni) {
      // Don't reveal whether email exists — generic message
      return res
        .status(404)
        .json({ message: "No account found with this email address" });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

    otpStore.set(email.toLowerCase(), { otp, expiresAt });

    //console.log(`\n📧 OTP for ${email}: ${otp} (expires in 10 minutes)\n`);

    await transporter.sendMail({
      from: `"PSG Alumni"<${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Password Reset OTP",
      html: `
        <h2>Pasword Reset Request</h2>
        <p>Your OTP is:</p>
        <h1>${otp}</h1>
        <p>This OTP is valid for 5 minutes.</p>
      `
    })

    res.json({ message: `OTP sent to ${email}. Check your inbox.` });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @route   POST /api/auth/verify-otp
// ✅ NEW: Verifies the OTP before allowing password reset
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const stored = otpStore.get(email.toLowerCase());

    if (!stored) {
      return res
        .status(400)
        .json({ message: "OTP not found. Please request a new one." });
    }

    if (Date.now() > stored.expiresAt) {
      otpStore.delete(email.toLowerCase());
      return res
        .status(400)
        .json({ message: "OTP has expired. Please request a new one." });
    }

    if (stored.otp !== otp.toString()) {
      return res
        .status(400)
        .json({ message: "Invalid OTP. Please try again." });
    }

    res.json({ message: "OTP verified successfully" });
  } catch (error) {
    console.error("Verify OTP Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @route   POST /api/auth/reset-password
// ✅ NEW: Resets password after OTP verification
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res
        .status(400)
        .json({ message: "Email, OTP, and new password are required" });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    // Verify OTP again before resetting
    const stored = otpStore.get(email.toLowerCase());

    if (!stored) {
      return res
        .status(400)
        .json({ message: "OTP not found. Please request a new one." });
    }

    if (Date.now() > stored.expiresAt) {
      otpStore.delete(email.toLowerCase());
      return res
        .status(400)
        .json({ message: "OTP has expired. Please request a new one." });
    }

    if (stored.otp !== otp.toString()) {
      return res.status(400).json({ message: "Invalid OTP." });
    }

    // Find alumni and update password
    const alumni = await Alumni.findOne({ email: email.toLowerCase() });
    if (!alumni) {
      return res.status(404).json({ message: "Account not found" });
    }

    alumni.password = await bcrypt.hash(newPassword, 10);
    await alumni.save();

    // Clear OTP after successful reset
    otpStore.delete(email.toLowerCase());

    res.json({ message: "Password reset successfully. You can now log in." });
  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @route   POST /api/auth/logout
exports.logout = (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
  });
  res.json({ message: "Logged out successfully" });
};
