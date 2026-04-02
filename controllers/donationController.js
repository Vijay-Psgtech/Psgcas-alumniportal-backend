// backend/controllers/donationController.js
// ✅ UPDATED:
//   - Accepts pan and aadhaar in request body
//   - Server-side PAN + Aadhaar validation (mirrors frontend)
//   - Amount clamped to ₹5,000 – ₹25,000
//   - Currency fixed to INR, gateway fixed to Razorpay
//   - Stripe block removed (INR-only product spec)

const crypto = require("crypto");
const Donation = require("../models/Donation");

// ── PAN / Aadhaar regex ──────────────────────────────────────────────────────
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const AADHAAR_REGEX = /^[0-9]{12}$/;

const MIN_AMOUNT = 5000;
const MAX_AMOUNT = 25000;

// ── Razorpay (initialise only if keys present) ───────────────────────────────
const Razorpay = require("razorpay");
const razorpay =
  process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
    ? new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      })
    : null;

// ─────────────────────────────────────────────────────────────────────────────
// 1. CREATE DONATION + INITIATE RAZORPAY ORDER
//    POST /api/donations
// ─────────────────────────────────────────────────────────────────────────────
exports.createDonations = async (req, res) => {
  try {
    const {
      donorName,
      donorEmail,
      pan,
      aadhaar,
      amount,
      paymentMethod = "razorpay",
      message = "",
      isAnonymous = false,
    } = req.body;

    // ── Amount validation ────────────────────────────────────────────────────
    const numericAmount = parseFloat(amount);
    if (!numericAmount || isNaN(numericAmount)) {
      return res.status(400).json({ message: "Invalid donation amount" });
    }
    if (numericAmount < MIN_AMOUNT) {
      return res.status(400).json({ message: `Minimum donation amount is ₹${MIN_AMOUNT.toLocaleString()}` });
    }
    if (numericAmount > MAX_AMOUNT) {
      return res.status(400).json({ message: `Maximum donation amount is ₹${MAX_AMOUNT.toLocaleString()}` });
    }

    // ── Donor info validation ────────────────────────────────────────────────
    if (!isAnonymous && (!donorName || !donorEmail)) {
      return res.status(400).json({ message: "Name and email are required for non-anonymous donations" });
    }

    // ── PAN validation (always required) ────────────────────────────────────
    if (!pan) {
      return res.status(400).json({ message: "PAN number is required" });
    }
    const panUpper = pan.trim().toUpperCase();
    if (!PAN_REGEX.test(panUpper)) {
      return res.status(400).json({ message: "Invalid PAN format. Expected: AAAAA9999A" });
    }

    // ── Aadhaar validation (always required) ─────────────────────────────────
    if (!aadhaar) {
      return res.status(400).json({ message: "Aadhaar number is required" });
    }
    const cleanAadhaar = aadhaar.replace(/\s/g, "");
    if (!AADHAAR_REGEX.test(cleanAadhaar)) {
      return res.status(400).json({ message: "Aadhaar must be exactly 12 digits" });
    }

    // ── Razorpay availability check ──────────────────────────────────────────
    if (!razorpay) {
      return res.status(500).json({
        message: "Payment gateway not configured. Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env",
      });
    }

    // ── Optionally link to alumni via JWT ────────────────────────────────────
    let alumniId = null;
    const token = req.headers.authorization?.split(" ")[1];
    if (token) {
      try {
        const decoded = require("jsonwebtoken").verify(token, process.env.JWT_SECRET);
        alumniId = decoded.id;
      } catch (_) {
        // Token invalid — continue as public donation
      }
    }

    // ── Persist donation (status: pending) ──────────────────────────────────
    const donation = new Donation({
      donorName: isAnonymous ? "Anonymous" : donorName.trim(),
      donorEmail: isAnonymous ? "" : donorEmail.trim().toLowerCase(),
      pan: panUpper,
      aadhaar: cleanAadhaar,
      amount: numericAmount,
      currency: "INR",
      paymentMethod,
      message,
      isAnonymous,
      alumniId: alumniId || null,
      status: "pending",
      transactionId: `TEMP-${Date.now()}`,
    });

    await donation.save();

    // ── Create Razorpay order ─────────────────────────────────────────────────
    const amountInPaise = Math.round(numericAmount * 100);
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: donation._id.toString(),
      notes: {
        donorName: donation.donorName,
        donorEmail: donation.donorEmail,
        message: donation.message,
      },
    });

    // Store Razorpay order ID in donation record
    donation.razorpayOrderId = order.id;
    await donation.save();

    return res.status(201).json({
      success: true,
      donation: {
        _id: donation._id,
        transactionId: donation.transactionId,
        status: donation.status,
      },
      razorpayOrderId: order.id,
      amount: numericAmount,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("❌ Donation creation error:", error);
    // Mongoose validation errors → 400
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message).join(", ");
      return res.status(400).json({ message: messages });
    }
    return res.status(500).json({ message: "Failed to create donation", error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. VERIFY RAZORPAY PAYMENT
//    POST /api/donations/verify-razorpay
// ─────────────────────────────────────────────────────────────────────────────
exports.verifyRazorPay = async (req, res) => {
  try {
    if (!razorpay) {
      return res.status(500).json({ message: "Razorpay is not configured" });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, donationId } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: "Missing payment verification parameters" });
    }

    // ── Verify HMAC signature ────────────────────────────────────────────────
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ message: "Invalid payment signature — possible tampered response" });
    }

    // ── Update donation record ───────────────────────────────────────────────
    const donation = donationId
      ? await Donation.findById(donationId)
      : await Donation.findOne({ razorpayOrderId: razorpay_order_id });

    if (!donation) {
      return res.status(404).json({ message: "Donation record not found" });
    }

    donation.status = "completed";
    donation.transactionId = razorpay_payment_id;
    donation.paymentGateway = "razorpay";
    donation.completedAt = new Date();
    await donation.save();

    return res.json({
      success: true,
      message: "Payment verified and donation completed",
      donation: {
        _id: donation._id,
        transactionId: donation.transactionId,
        amount: donation.amount,
        status: donation.status,
        completedAt: donation.completedAt,
      },
    });
  } catch (error) {
    console.error("❌ Razorpay verification error:", error);
    return res.status(500).json({ message: "Verification failed", error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. GET ALL DONATIONS (Admin)
//    GET /api/donations/donations
// ─────────────────────────────────────────────────────────────────────────────
exports.getAllDonations = async (req, res) => {
  try {
    // Exclude sensitive KYC fields from admin listing
    const donations = await Donation.find()
      .select("-pan -aadhaar")
      .sort({ createdAt: -1 });

    const completed = donations.filter((d) => d.status === "completed");
    const stats = {
      total: donations.length,
      completed: completed.length,
      pending: donations.filter((d) => d.status === "pending").length,
      failed: donations.filter((d) => d.status === "failed").length,
      totalAmount: completed.reduce((sum, d) => sum + d.amount, 0),
    };

    return res.json({ donations, stats });
  } catch (error) {
    console.error("❌ Get donations error:", error);
    return res.status(500).json({ message: "Failed to fetch donations" });
  }
};