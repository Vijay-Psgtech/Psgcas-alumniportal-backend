// backend/controllers/authController.js - FIXED VERSION
// ✅ Properly stores data in database
// ✅ Retrieves profile from database
// ✅ Updates profile in database

const Alumni = require("../models/Alumni");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const generateToken = (id, isAdmin = false) => {
  return jwt.sign(
    { id, isAdmin },
    process.env.JWT_SECRET || "your-secret-key",
    { expiresIn: "7d" }
  );
};

// ✅ REGISTER - Save all user data to database
exports.register = async (req, res) => {
  try {
    console.log("\n📋 REGISTER REQUEST");
    
    const {
      firstName,
      lastName,
      email,
      password,
      department,
      graduationYear,
      country,
      city,
      phone = "",
      company = "",
    } = req.body;

    console.log("📧 Email:", email);
    console.log("👤 Name:", firstName, lastName);
    console.log("🏢 Department:", department);
    console.log("📅 Year:", graduationYear);
    console.log("🌍 Country:", country);
    console.log("📍 City:", city);

    // Validate required fields
    const errors = {};
    if (!firstName?.trim()) errors.firstName = "First name required";
    if (!lastName?.trim()) errors.lastName = "Last name required";
    if (!email?.trim()) errors.email = "Email required";
    if (!password) errors.password = "Password required";
    if (!country) errors.country = "Country required";
    if (!city?.trim()) errors.city = "City required";

    if (Object.keys(errors).length > 0) {
      console.log("❌ Validation errors:", errors);
      return res.status(400).json({ message: "Missing required fields", errors });
    }

    // Check if email already exists
    const existingAlumni = await Alumni.findOne({ email: email.toLowerCase() });
    if (existingAlumni) {
      console.log("❌ Email already exists:", email);
      return res.status(409).json({
        message: "Email already registered",
        error: "DUPLICATE_EMAIL",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ Create new alumni record with ALL fields
    const newAlumni = new Alumni({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      department,
      graduationYear: parseInt(graduationYear),
      country,
      city: city.trim(),
      phone: phone.trim(),
      company: company.trim(),
      isApproved: false, // New registrations pending approval
      isAdmin: false,
    });

    // ✅ Save to database
    await newAlumni.save();
    console.log("✅ Alumni record saved to database:", newAlumni._id);

    // Generate token
    const token = generateToken(newAlumni._id, newAlumni.isAdmin);

    // Prepare response (don't send password)
    const alumniData = newAlumni.toObject();
    delete alumniData.password;

    console.log("📤 Sending success response with all data");

    return res.status(201).json({
      message: "Registration successful",
      token,
      alumni: alumniData,
    });
  } catch (error) {
    console.error("❌ Registration error:", error);
    return res.status(500).json({
      message: "Registration failed",
      error: error.message,
    });
  }
};

// ✅ LOGIN - Find user in database and authenticate
exports.login = async (req, res) => {
  try {
    console.log("\n🔐 LOGIN REQUEST");
    
    const { email, password } = req.body;
    console.log("📧 Email:", email);

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    // ✅ Find user in database
    const alumni = await Alumni.findOne({ email: email.toLowerCase() }).select("+password");
    if (!alumni) {
      console.log("❌ Alumni not found:", email);
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, alumni.password);
    if (!isPasswordValid) {
      console.log("❌ Invalid password for:", email);
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // Generate token
    const token = generateToken(alumni._id, alumni.isAdmin);

    // Prepare response
    const alumniData = alumni.toObject();
    delete alumniData.password;

    console.log("✅ Login successful for:", email);

    return res.status(200).json({
      message: "Login successful",
      token,
      alumni: alumniData,
    });
  } catch (error) {
    console.error("❌ Login error:", error);
    return res.status(500).json({
      message: "Login failed",
      error: error.message,
    });
  }
};

// ✅ GET PROFILE - Retrieve user data from database
exports.getProfile = async (req, res) => {
  try {
    console.log("\n👤 GET PROFILE REQUEST");
    
    const alumniId = req.user.id;
    console.log("🔍 Looking up alumni:", alumniId);

    // ✅ Find alumni in database
    const alumni = await Alumni.findById(alumniId);
    if (!alumni) {
      console.log("❌ Alumni not found:", alumniId);
      return res.status(404).json({
        message: "Alumni not found",
      });
    }

    console.log("✅ Profile found in database:", alumni._id);

    return res.status(200).json({
      message: "Profile retrieved",
      alumni: alumni,
    });
  } catch (error) {
    console.error("❌ Get profile error:", error);
    return res.status(500).json({
      message: "Failed to retrieve profile",
      error: error.message,
    });
  }
};

// ✅ UPDATE PROFILE - Update user data in database
exports.updateProfile = async (req, res) => {
  try {
    console.log("\n✏️  UPDATE PROFILE REQUEST");
    
    const alumniId = req.user.id;
    const updateData = req.body;

    console.log("🔍 Updating alumni:", alumniId);
    console.log("📝 Update data:", Object.keys(updateData));

    // Prevent password and email updates through this endpoint
    delete updateData.password;
    delete updateData.email;

    // ✅ Update in database
    const alumni = await Alumni.findByIdAndUpdate(
      alumniId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!alumni) {
      console.log("❌ Alumni not found:", alumniId);
      return res.status(404).json({
        message: "Alumni not found",
      });
    }

    console.log("✅ Profile updated in database:", alumni._id);

    return res.status(200).json({
      message: "Profile updated successfully",
      alumni: alumni,
    });
  } catch (error) {
    console.error("❌ Update profile error:", error);
    return res.status(500).json({
      message: "Failed to update profile",
      error: error.message,
    });
  }
};

// ✅ CHANGE PASSWORD
exports.changePassword = async (req, res) => {
  try {
    const alumniId = req.user.id;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        message: "Old password and new password are required",
      });
    }

    // ✅ Get user with password field
    const alumni = await Alumni.findById(alumniId).select("+password");
    if (!alumni) {
      return res.status(404).json({
        message: "Alumni not found",
      });
    }

    // Verify old password
    const isPasswordValid = await bcrypt.compare(oldPassword, alumni.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Old password is incorrect",
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    alumni.password = hashedPassword;
    
    // ✅ Save to database
    await alumni.save();

    return res.status(200).json({
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("❌ Change password error:", error);
    return res.status(500).json({
      message: "Failed to change password",
      error: error.message,
    });
  }
};

// ✅ FORGOT PASSWORD
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const alumni = await Alumni.findOne({ email: email.toLowerCase() });
    if (!alumni) {
      return res.status(404).json({
        message: "Email not found",
      });
    }

    // Generate OTP (6 digits)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpire = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // ✅ Store OTP in database
    alumni.resetOtp = otp;
    alumni.resetOtpExpire = otpExpire;
    await alumni.save();

    console.log("📧 OTP sent to", email, ":", otp);

    return res.status(200).json({
      message: "OTP sent to your email",
    });
  } catch (error) {
    console.error("❌ Forgot password error:", error);
    return res.status(500).json({
      message: "Failed to process forgot password",
      error: error.message,
    });
  }
};

// ✅ VERIFY OTP
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        message: "Email and OTP are required",
      });
    }

    const alumni = await Alumni.findOne({ email: email.toLowerCase() });
    if (!alumni) {
      return res.status(404).json({
        message: "Email not found",
      });
    }

    // Check OTP validity
    if (alumni.resetOtp !== otp) {
      return res.status(400).json({
        message: "Invalid OTP",
      });
    }

    if (new Date() > alumni.resetOtpExpire) {
      return res.status(400).json({
        message: "OTP expired",
      });
    }

    return res.status(200).json({
      message: "OTP verified successfully",
    });
  } catch (error) {
    console.error("❌ Verify OTP error:", error);
    return res.status(500).json({
      message: "Failed to verify OTP",
      error: error.message,
    });
  }
};

// ✅ RESET PASSWORD
exports.resetPassword = async (req, res) => {
  try {
    const { email, newPassword, otp } = req.body;

    if (!email || !newPassword || !otp) {
      return res.status(400).json({
        message: "Email, new password, and OTP are required",
      });
    }

    const alumni = await Alumni.findOne({ email: email.toLowerCase() });
    if (!alumni) {
      return res.status(404).json({
        message: "Email not found",
      });
    }

    // Verify OTP
    if (alumni.resetOtp !== otp) {
      return res.status(400).json({
        message: "Invalid OTP",
      });
    }

    if (new Date() > alumni.resetOtpExpire) {
      return res.status(400).json({
        message: "OTP expired",
      });
    }

    // Hash and set new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    alumni.password = hashedPassword;
    alumni.resetOtp = null;
    alumni.resetOtpExpire = null;
    
    // ✅ Save to database
    await alumni.save();

    return res.status(200).json({
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("❌ Reset password error:", error);
    return res.status(500).json({
      message: "Failed to reset password",
      error: error.message,
    });
  }
};