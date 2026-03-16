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
      return res.status(400).json({
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

// ─────────────────────────────────────────────────────────────
// 2️⃣ RAZORPAY PAYMENT GATEWAY
// ─────────────────────────────────────────────────────────────
async function initializeRazorpayPayment(donation, amountInINR) {
  try {
    if (!razorpay) {
      throw new Error("Razorpay is not configured");
    }
    const amountInPaise = Math.round(amountInINR * 100); // convert to paise

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

    return {
      gateway: "razorpay",
      orderId: order.id,
      amount: amountInINR,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
      name: "PSG Tech Alumni Foundation",
      description: "Support PSG Tech - Donation",
      prefill: {
        name: donation.donorName,
        email: donation.donorEmail,
      },
    };
  } catch (error) {
    console.error("❌ Razorpay error:", error);
    throw new Error("Failed to initialize Razorpay payment");
  }
}

// ─────────────────────────────────────────────────────────────
// 3️⃣ STRIPE PAYMENT GATEWAY
// ─────────────────────────────────────────────────────────────
async function initializeStripePayment(donation, amountInUSD) {
  try {
    if (!stripe) {
      throw new Error("Stripe is not configured");
    }

    const amountInCents = Math.round(amountInUSD * 100); // Convert to cents

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "PSG Tech Alumni Foundation Donation",
              description: `Support PSG Tech - ${donation.message || "General donation"}`,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/donate/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/donate?cancelled=true`,
      customer_email: donation.donorEmail,
      metadata: {
        donationId: donation._id.toString(),
        donorName: donation.donorName,
      },
    });

    return {
      gateway: "stripe",
      sessionId: session.id,
      amount: amountInUSD,
      currency: "USD",
      clientSecret: session.client_secret,
      url: session.url,
    };
  } catch (error) {
    console.error("❌ Stripe error:", error);
    throw new Error("Failed to initialize Stripe payment");
  }
}

// ─────────────────────────────────────────────────────────────
// 4️⃣ VERIFY RAZORPAY PAYMENT
// ─────────────────────────────────────────────────────────────
// POST /api/donations/verify-razorpay
exports.verifyRazorPay = async (req, res) => {
  try {
    if (!razorpay) {
      return res.status(500).json({ message: "Razorpay is not configured" });
    }
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    // ✅ Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const crypto = require("crypto");
    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({ message: "Invalid payment signature" });
    }

    // ✅ Update donation status
    const donation = await Donation.findById(req.body.donationId);
    if (!donation) {
      return res.status(404).json({ message: "Donation not found" });
    }

    donation.status = "completed";
    donation.transactionId = razorpay_payment_id;
    donation.paymentGateway = "razorpay";
    donation.completedAt = new Date();
    await donation.save();

    // ✅ Send confirmation email
    await sendDonationConfirmationEmail(donation);

    res.json({
      success: true,
      message: "Payment verified successfully",
      donation,
    });
  } catch (error) {
    console.error("❌ Razorpay verification error:", error);
    res
      .status(500)
      .json({ message: "Verification failed", error: error.message });
  }
};

//─────────────────────────────────────────────────────────────
// Get All donations
// ─────────────────────────────────────────────────────────────
exports.getAllDonations = async (req, res) => {
  try {
    const donations = await Donation.find().sort({ createdAt: -1 });

    const stats = {
      total: donations.length,
      completed: donations.filter((d) => d.status === "completed").length,
      pending: donations.filter((d) => d.status === "pending").length,
      totalAmount: donations
        .filter((d) => d.status === "completed")
        .reduce((sum, d) => sum + d.amount, 0),
    };

    res.json({ donations, stats });
  } catch (error) {
    console.error("❌ Admin get donations error:", error);
    res.status(500).json({ message: "Failed to fetch donations" });
  }
};
