// backend/controllers/authController.js
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");
const axios = require("axios");
const User = require("../models/Users");
const Alumni = require("../models/Alumni");
const { createRegistrationPayment } = require("./membershipPaymentController");
const { transporter } = require("../config/mailer");

// Initialize OAuth clients
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const FACEBOOK_VERIFY_URL = "https://graph.facebook.com/me";

// ══════════════════════════════════════════════════════════════════════════
// HELPER: Generate JWT Token
// ══════════════════════════════════════════════════════════════════════════
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role || "alumni",
      department: user.role === "admin" ? user.department : undefined,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

const setAuthCookie = (res, token, maxAge = 7 * 24 * 60 * 60 * 1000) => {
  res.clearCookie("token", { path: "/api/auth" });
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
};

// ══════════════════════════════════════════════════════════════════════════
// REGISTER
// ══════════════════════════════════════════════════════════════════════════
const register = createRegistrationPayment;

// ══════════════════════════════════════════════════════════════════════════
// LOGIN (Email/Password)
// ══════════════════════════════════════════════════════════════════════════
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (typeof email !== "string" || !email.trim() || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    // Check both User (admin) and Alumni tables
    const normalizedEmail = email.trim().toLowerCase();
    let user = await User.findOne({ email: normalizedEmail }).select("+password");
    let isAdmin = !!user;

    if (!user) {
      user = await Alumni.findOne({ email: normalizedEmail }).select("+password");
      if (!user) {
        return res.status(401).json({
          message: "Invalid email or password",
        });
      }
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // Check if alumni is approved (for alumni only)
    if (!isAdmin && !user.isApproved) {
      return res.status(403).json({
        message: "Your account is pending admin approval",
      });
    }

    // Generate JWT
    const token = generateToken(user);

    // Login is under /api/auth, but the cookie must also reach /api/admin.
    setAuthCookie(res, token);

    console.log(`✅ User logged in: ${user.email}`);

    res.status(200).json({
      message: "Login successful",
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: isAdmin ? user.role : "alumni",
        department: isAdmin ? user.department : undefined,
        isAdmin,
        isApproved: user.isApproved ?? true,
        profileImage: user.profileImage || null,
      },
    });
  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({
      message: "Login failed",
      error: error.message,
    });
  }
};

// ══════════════════════════════════════════════════════════════════════════
// SOCIAL LOGIN (Google & Facebook)
// ══════════════════════════════════════════════════════════════════════════
const socialLogin = async (req, res) => {
  try {
    const { provider, idToken, accessToken } = req.body;

    if (!provider) {
      return res.status(400).json({
        message: "Provider is required",
      });
    }

    let userData;

    // ═══════════════════════════════════════════════════════════════════════
    // GOOGLE VERIFICATION
    // ═══════════════════════════════════════════════════════════════════════
    if (provider === "google") {
      if (!idToken) {
        return res.status(400).json({
          message: "No ID token provided",
        });
      }

      try {
        const ticket = await googleClient.verifyIdToken({
          idToken,
          audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const nameParts = (payload.name || "").split(" ");

        userData = {
          email: payload.email,
          firstName: payload.given_name || nameParts[0] || "User",
          lastName: payload.family_name || nameParts[1] || "",
          googleId: payload.sub,
          profileImage: payload.picture || null,
          provider: "google",
        };

        console.log("✅ Google token verified for:", userData.email);
      } catch (error) {
        console.error("❌ Google token verification failed:", error.message);
        return res.status(401).json({
          message: "Invalid Google token",
          error: error.message,
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // FACEBOOK VERIFICATION
    // ═══════════════════════════════════════════════════════════════════════
    else if (provider === "facebook") {
      if (!accessToken) {
        return res.status(400).json({
          message: "No access token provided",
        });
      }

      try {
        const response = await axios.get(FACEBOOK_VERIFY_URL, {
          params: {
            access_token: accessToken,
            fields: "id,name,email,picture.type(large)",
          },
        });

        const facebookData = response.data;

        if (!facebookData.id) {
          throw new Error("No user ID in Facebook response");
        }

        const nameParts = (facebookData.name || "").split(" ");

        userData = {
          email:
            facebookData.email ||
            `fb_${facebookData.id}@facebook.local`,
          firstName: nameParts[0] || "User",
          lastName: nameParts[1] || "",
          facebookId: facebookData.id,
          profileImage: facebookData.picture?.data?.url || null,
          provider: "facebook",
        };

        console.log(
          "✅ Facebook token verified for:",
          userData.email
        );
      } catch (error) {
        console.error(
          "❌ Facebook token verification failed:",
          error.message
        );
        return res.status(401).json({
          message: "Invalid Facebook token",
          error: error.message,
        });
      }
    } else {
      return res.status(400).json({
        message: `Unsupported provider: ${provider}`,
      });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // FIND OR CREATE USER (Alumni)
    // ═══════════════════════════════════════════════════════════════════════
    let user = await Alumni.findOne({ email: userData.email });

    if (!user) {
      return res.status(403).json({
        message:
          "Complete alumni registration and membership payment before using social login.",
      });
    }

    if (user.membershipPayment?.status !== "paid") {
      return res.status(403).json({
        message: "Membership payment must be verified before social login.",
      });
    }
    if (!user.isApproved) {
      return res.status(403).json({
        message: "Your membership is awaiting administrator approval.",
      });
    }

    // Link social account to an existing paid and approved member.
    const socialIdField = userData.provider + "Id";
    if (!user[socialIdField]) {
      user[socialIdField] = userData[socialIdField];
      if (userData.profileImage && !user.profileImage) {
        user.profileImage = userData.profileImage;
      }
      await user.save();
      console.log(
        `✅ Linked ${userData.provider}Id to existing user:`,
        user.email
      );
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GENERATE JWT & SET COOKIE
    // ═══════════════════════════════════════════════════════════════════════
    const token = generateToken(user);

    setAuthCookie(res, token);

    console.log(
      `✅ ${userData.provider} social login successful:`,
      user.email
    );

    res.status(200).json({
      message: `${provider} login successful`,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: "alumni",
        isApproved: user.isApproved ?? false,
        profileImage: user.profileImage || null,
      },
    });
  } catch (error) {
    console.error("❌ Social login error:", error);
    res.status(500).json({
      message: "Social login failed",
      error: error.message,
    });
  }
};

// ══════════════════════════════════════════════════════════════════════════
// GET PROFILE
// ══════════════════════════════════════════════════════════════════════════
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    // Check both User (admin) and Alumni tables
    let user = await User.findById(userId).select("-password");
    let isAdmin = !!user;

    if (!user) {
      user = await Alumni.findById(userId).select("-password");
      if (!user) {
        return res.status(404).json({
          message: "User not found",
        });
      }
    }

    const token = req.cookies?.token;
    if (token && req.user.exp) {
      const remainingLifetime = req.user.exp * 1000 - Date.now();
      if (remainingLifetime > 0) setAuthCookie(res, token, remainingLifetime);
    }

    res.status(200).json({
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: isAdmin ? user.role : "alumni",
        isAdmin,
        isApproved: user.isApproved ?? true,
        profileImage: user.profileImage || null,
      },
    });
  } catch (error) {
    console.error("❌ Get profile error:", error);
    res.status(500).json({
      message: "Failed to fetch profile",
      error: error.message,
    });
  }
};

// ══════════════════════════════════════════════════════════════════════════
// LOGOUT
// ══════════════════════════════════════════════════════════════════════════
const logout = async (req, res) => {
  try {
    res.clearCookie("token", { path: "/api/auth" });
    res.clearCookie("token", { path: "/" });
    res.status(200).json({
      message: "Logout successful",
    });
  } catch (error) {
    console.error("❌ Logout error:", error);
    res.status(500).json({
      message: "Logout failed",
      error: error.message,
    });
  }
};

// ══════════════════════════════════════════════════════════════════════════
// CHANGE PASSWORD
// ══════════════════════════════════════════════════════════════════════════
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message:
          "Current password and new password are required",
      });
    }
    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return res.status(400).json({
        message: "New password must contain at least 8 characters",
      });
    }

    // Check both tables
    let user = await User.findById(userId).select("+password");
    if (!user) {
      user = await Alumni.findById(userId).select("+password");
    }

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Verify current password
    if (!user.password) {
      return res.status(401).json({
        message: "Current password is incorrect",
      });
    }
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Current password is incorrect",
      });
    }

    // Hash and update new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.status(200).json({
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("❌ Change password error:", error);
    res.status(500).json({
      message: "Password change failed",
      error: error.message,
    });
  }
};

// ══════════════════════════════════════════════════════════════════════════
// FORGOT PASSWORD
// ══════════════════════════════════════════════════════════════════════════
const RESET_OTP_LIFETIME_MS = 10 * 60 * 1000;
const RESET_OTP_MAX_ATTEMPTS = 5;

const hashResetOtp = (otp) =>
  crypto.createHash("sha256").update(otp).digest();

const isResetOtpValid = (user, otp) => {
  if (
    !user.resetOtp ||
    !user.resetOtpExpiry ||
    user.resetOtpExpiry.getTime() <= Date.now() ||
    user.resetOtpAttempts >= RESET_OTP_MAX_ATTEMPTS
  ) {
    return false;
  }
  const expected = Buffer.from(user.resetOtp, "hex");
  const actual = hashResetOtp(otp);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
};

const clearResetOtp = (user) => {
  user.resetOtp = undefined;
  user.resetOtpExpiry = undefined;
  user.resetOtpAttempts = 0;
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const resetFields =
      "+resetOtp +resetOtpExpiry +resetOtpAttempts +resetOtpSentAt";
    let user = await User.findOne({ email: normalizedEmail }).select(resetFields);
    if (!user) {
      user = await Alumni.findOne({ email: normalizedEmail }).select(resetFields);
    }

    if (user) {
      if (
        user.resetOtpSentAt &&
        Date.now() - user.resetOtpSentAt.getTime() < 60 * 1000
      ) {
        return res.status(200).json({
          message: "If an account exists for that email, a password reset code has been sent.",
        });
      }
      const otp = String(crypto.randomInt(100000, 1000000));
      user.resetOtp = hashResetOtp(otp).toString("hex");
      user.resetOtpExpiry = new Date(Date.now() + RESET_OTP_LIFETIME_MS);
      user.resetOtpAttempts = 0;
      user.resetOtpSentAt = new Date();
      await user.save();
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: normalizedEmail,
          subject: "PSG CAS Alumni Portal password reset code",
          text: `Your password reset code is ${otp}. It expires in 10 minutes. If you did not request this code, you can ignore this email.`,
        });
      } catch (emailError) {
        clearResetOtp(user);
        await user.save();
        throw emailError;
      }
    }

    res.status(200).json({
      message: "If an account exists for that email, a password reset code has been sent.",
    });
  } catch (error) {
    console.error("❌ Forgot password error:", error);
    res.status(500).json({
      message: "Forgot password failed",
      error: error.message,
    });
  }
};

// ══════════════════════════════════════════════════════════════════════════
// VERIFY OTP
// ══════════════════════════════════════════════════════════════════════════
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (typeof email !== "string" || !email.trim() || typeof otp !== "string" || !otp.trim()) {
      return res.status(400).json({
        message: "Email and OTP are required",
      });
    }

    // Check both tables
    const normalizedEmail = email.trim().toLowerCase();
    const resetFields =
      "+resetOtp +resetOtpExpiry +resetOtpAttempts";
    let user = await User.findOne({ email: normalizedEmail }).select(resetFields);
    if (!user) {
      user = await Alumni.findOne({ email: normalizedEmail }).select(resetFields);
    }

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired OTP",
      });
    }

    if (!isResetOtpValid(user, String(otp))) {
      if (user.resetOtp && user.resetOtpExpiry?.getTime() > Date.now()) {
        user.resetOtpAttempts += 1;
        if (user.resetOtpAttempts >= RESET_OTP_MAX_ATTEMPTS) clearResetOtp(user);
        await user.save();
      }
      return res.status(400).json({
        message: "Invalid or expired OTP",
      });
    }

    res.status(200).json({
      message: "OTP verified successfully",
    });
  } catch (error) {
    console.error("❌ Verify OTP error:", error);
    res.status(500).json({
      message: "OTP verification failed",
      error: error.message,
    });
  }
};

// ══════════════════════════════════════════════════════════════════════════
// RESET PASSWORD
// ══════════════════════════════════════════════════════════════════════════
const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (
      typeof email !== "string" ||
      !email.trim() ||
      typeof otp !== "string" ||
      !otp.trim() ||
      typeof newPassword !== "string" ||
      !newPassword
    ) {
      return res.status(400).json({
        message:
          "Email, OTP, and new password are required",
      });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({
        message: "New password must contain at least 8 characters",
      });
    }

    // Check both tables
    const normalizedEmail = email.trim().toLowerCase();
    const resetFields = "+resetOtp +resetOtpExpiry +resetOtpAttempts +password";
    let user = await User.findOne({ email: normalizedEmail }).select(resetFields);
    if (!user) {
      user = await Alumni.findOne({ email: normalizedEmail }).select(resetFields);
    }

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired OTP",
      });
    }

    if (!isResetOtpValid(user, String(otp))) {
      if (user.resetOtp && user.resetOtpExpiry?.getTime() > Date.now()) {
        user.resetOtpAttempts += 1;
        if (user.resetOtpAttempts >= RESET_OTP_MAX_ATTEMPTS) clearResetOtp(user);
        await user.save();
      }
      return res.status(400).json({
        message: "Invalid or expired OTP",
      });
    }

    // Hash and update password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    clearResetOtp(user);
    await user.save();

    console.log(`✅ Password reset successful for:`, user.email);

    res.status(200).json({
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("❌ Reset password error:", error);
    res.status(500).json({
      message: "Password reset failed",
      error: error.message,
    });
  }
};

module.exports = {
  register,
  login,
  logout,
  getProfile,
  changePassword,
  forgotPassword,
  verifyOtp,
  resetPassword,
  socialLogin,  // ✅ NEW
};