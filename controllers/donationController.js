const Donation = require("../models/Donation");
const authenticate = require("../middleware/authenticate");

// Fixed: Initialize Stripe only if STRIPE_SECRET_KEY exsits
const stripe = process.env.STRIPE_SECRET_KEY
  ? require("stripe")(process.env.STRIPE_SECRET_KEY)
  : null;

// ✅ FIXED: Initialize Razorpay only if keys exist
const Razorpay = require("razorpay");
const razorpay =
  process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
    ? new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      })
    : null;

// ─────────────────────────────────────────────────────────────
// 1️⃣ CREATE DONATION + INITIATE PAYMENT
// ─────────────────────────────────────────────────────────────
// POST /api/donations
// Public route - anyone can donate
// If JWT token present in headers, auto-links donation to alumni account

exports.createDonations = async (req, res) => {
  try {
    const {
      donorName,
      donorEmail,
      amount,
      currency,
      paymentMethod,
      message,
      isAnonymous,
    } = req.body;

    // ✅ Validation
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    const minAmount = currency === "INR" ? 100 : 5;
    if (amount < minAmount) {
      return res.status(400).json({
        message: `Minimum donation is ${currency === "INR" ? "₹100" : "$5"}`,
      });
    }

    if (!isAnonymous && (!donorName || !donorEmail)) {
      return res
        .status(400)
        .json({
          message: "Name and email required for non-anonymous donations",
        });
    }

    // ✅ Get alumni ID from JWT token if available
    let alumniId = null;
    const token = req.headers.authorization?.split(" ")[1];
    if (token) {
      try {
        const decoded = require("jsonwebtoken").verify(
          token,
          process.env.JWT_SECRET,
        );
        alumniId = decoded.id;
      } catch (err) {
        // Token invalid, continue as public donation
      }
    }

    // ✅ Create donation record in database
    const donation = new Donation({
      donorName: isAnonymous ? "Anonymous" : donorName,
      donorEmail: isAnonymous ? "" : donorEmail,
      amount,
      currency,
      paymentMethod,
      message,
      isAnonymous,
      alumniId: alumniId || null,
      status: "pending", // Payment not yet processed
      transactionId: `TEMP-${Date.now()}`, // Temporary ID, will be updated after payment
    });

    await donation.save();

    // ✅ Initialize payment based on currency and payment method
    let paymentResponse = {};

    // Route to payment gateway based on currency and method
    if (
      currency === "INR" &&
      paymentMethod !== "Cheque" &&
      paymentMethod !== "Wire Transfer"
    ) {
      // Use Razorpay for INR (UPI, Net Banking, Card)
      if (!razorpay) {
        return res.status(500).json({
          message:
            "Razorpay is not configured. Please check your environment variables.",
        });
      }
      paymentResponse = await initializeRazorpayPayment(donation, amount);
    } else if (currency === "USD" && paymentMethod === "Card") {
      // Use Stripe for USD cards
      if (!stripe) {
        return res.status(500).json({
          message:
            "Stripe is not configured. Please check your environment variables.",
        });
      }
      paymentResponse = await initializeStripePayment(donation, amount);
    } else if (
      paymentMethod === "Cheque" ||
      paymentMethod === "Wire Transfer"
    ) {
      // Manual payment methods
      paymentResponse = {
        status: "manual",
        message: "Please send cheque/wire transfer to the provided details",
      };
    } else if (currency === "USD") {
      // USD without specific method - use Stripe
      if (!stripe) {
        return res.status(500).json({
          message:
            "Stripe is not configured. Please check your environment variables.",
        });
      }
      paymentResponse = await initializeStripePayment(donation, amount);
    }

    res.status(201).json({
      success: true,
      donation: {
        _id: donation._id,
        transactionId: donation.transactionId,
        status: donation.status,
      },
      payment: paymentResponse,
    });
  } catch (error) {
    console.error("❌ Donation creation error:", error);
    res.status(500).json({
      message: "Failed to create donation",
      error: error.message,
    });
  }
};
