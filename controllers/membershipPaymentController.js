const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const Alumni = require("../models/Alumni");
const PendingAlumniRegistration = require("../models/PendingAlumniRegistration");
const util = require("../util");
const { transporter } = require("../config/mailer");

const fee = Number(process.env.ALUMNI_MEMBERSHIP_FEE || 600);
const paymentEnv = process.env.EASEBUZZ_ENV === "prod" ? "prod" : "test";
const paymentUrl =
  paymentEnv === "prod"
    ? "https://pay.easebuzz.in/payment/initiateLink"
    : "https://testpay.easebuzz.in/payment/initiateLink";

const getEncryptionKey = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET must be configured to protect pending registration data");
  }
  return crypto.createHash("sha256").update(process.env.JWT_SECRET).digest();
};

const encryptProfile = (profile) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(profile), "utf8"),
    cipher.final(),
  ]);
  return `${iv.toString("hex")}.${cipher.getAuthTag().toString("hex")}.${ciphertext.toString("hex")}`;
};

const decryptProfile = (encryptedProfile) => {
  const [ivHex, tagHex, ciphertextHex] = encryptedProfile.split(".");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, "hex")),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString("utf8"));
};

const parseObject = (value, fieldName) => {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${fieldName} must contain valid JSON`);
  }
};

const getFiles = (files = {}) =>
  Object.fromEntries(
    Object.entries(files).map(([field, entries]) => [
      field,
      `/uploads/alumni/${entries[0].destination.split(/[\\/]/).pop()}/${entries[0].filename}`,
    ]),
  );

const removeUploadDirectory = async (alumniId) => {
  const root = path.resolve(__dirname, "../uploads/alumni");
  const target = path.resolve(root, alumniId);
  if (!target.startsWith(`${root}${path.sep}`)) {
    throw new Error("Invalid alumni upload directory");
  }
  await fs.rm(target, { recursive: true, force: true });
};

const cleanupRequestUploads = async (alumniId) => {
  if (!alumniId) return;
  try {
    await removeUploadDirectory(alumniId);
  } catch (error) {
    console.error(`Unable to remove temporary uploads for ${alumniId}:`, error);
  }
};

const validateRegistration = (body) => {
  const required = [
    "firstName",
    "email",
    "password",
    "phone",
    "department",
    "batchYear",
    "studyStartYear",
    "studyEndYear",
    "fullAddress",
    "postalAddress",
  ];
  const missing = required.filter(
    (field) => typeof body[field] !== "string" || !body[field].trim(),
  );
  if (missing.length) {
    throw new Error(`Missing required registration fields: ${missing.join(", ")}`);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
    throw new Error("Enter a valid email address");
  }
  if (body.password.length < 6) {
    throw new Error("Password must contain at least 6 characters");
  }
  if (
    !/^\d{4}$/.test(body.studyStartYear) ||
    !/^\d{4}$/.test(body.studyEndYear) ||
    Number(body.studyStartYear) > Number(body.studyEndYear)
  ) {
    throw new Error("Study years must be valid and joining year cannot follow completion year");
  }
  const postalAddress = parseObject(body.postalAddress, "postalAddress");
  const educationHistory = body.educationHistory
    ? parseObject(body.educationHistory, "educationHistory")
    : [];
  if (!Array.isArray(educationHistory)) {
    throw new Error("educationHistory must be a list");
  }
  if (
    educationHistory.some((item) => {
      if (
        !item ||
        typeof item.department !== "string" ||
        typeof item.degree !== "string" ||
        typeof item.studyStartYear !== "string" ||
        typeof item.studyEndYear !== "string"
      ) {
        return true;
      }
      const startYear = Number(item.studyStartYear);
      const endYear = Number(item.studyEndYear);
      return (
        !item.department.trim() ||
        !item.degree.trim() ||
        !/^\d{4}$/.test(item.studyStartYear) ||
        !/^\d{4}$/.test(item.studyEndYear) ||
        startYear > endYear
      );
    })
  ) {
    throw new Error(
      "Every education entry must include department, degree, and valid joining/completion years",
    );
  }
  if (
    !postalAddress.line1 ||
    !postalAddress.city ||
    !postalAddress.state ||
    !postalAddress.pincode ||
    !postalAddress.country
  ) {
    throw new Error("Complete postal address and PIN code are required");
  }
  if (!Number.isFinite(fee) || fee <= 0) {
    throw new Error("ALUMNI_MEMBERSHIP_FEE must be a positive number");
  }
};

exports.createRegistrationPayment = async (req, res) => {
  let pending;
  try {
    validateRegistration(req.body);
    if (process.env.NODE_ENV === "production" && paymentEnv !== "prod") {
      throw new Error("Production registrations require the live Easebuzz environment");
    }
    if (
      !process.env.EMAIL_USER ||
      !process.env.EMAIL_PASS ||
      !process.env.ADMIN_EMAIL
    ) {
      throw new Error("Receipt email settings must be configured before checkout");
    }

    const email = req.body.email.trim().toLowerCase();
    if (await Alumni.exists({ email })) {
      await cleanupRequestUploads(req.alumniId);
      return res.status(409).json({ message: "Email already registered" });
    }

    const expiredPending = await PendingAlumniRegistration.findOne({
      email,
      expiresAt: { $lte: new Date() },
    });
    if (expiredPending) {
      await PendingAlumniRegistration.deleteOne({ _id: expiredPending._id });
      await cleanupRequestUploads(expiredPending.alumniId);
    }

    const existingPending = await PendingAlumniRegistration.findOne({
      email,
      expiresAt: { $gt: new Date() },
    });
    if (existingPending) {
      await cleanupRequestUploads(req.alumniId);
      return res.status(409).json({
        message: "A membership payment is already in progress for this email",
      });
    }

    const officeAddress = parseObject(req.body.officeAddress, "officeAddress");
    const postalAddress =
      parseObject(req.body.postalAddress, "postalAddress");
    const coordinates = parseObject(req.body.coordinates, "coordinates");
    const social = {
      linkedin: req.body.linkedin || "",
      twitter: req.body.twitter || "",
      instagram: req.body.instagram || "",
      facebook: req.body.facebook || "",
      website: req.body.website || "",
    };
    const educationHistory = parseObject(
      req.body.educationHistory || "[]",
      "educationHistory",
    );
    if (!Array.isArray(educationHistory)) {
      throw new Error("educationHistory must be a list");
    }
    const completeEducationHistory = educationHistory.length
      ? educationHistory
      : [
          {
            department: req.body.department.trim(),
            degree: (req.body.degree || "").trim(),
            studyStartYear: req.body.studyStartYear.trim(),
            studyEndYear: req.body.studyEndYear.trim(),
          },
        ];
    const batchDetails = completeEducationHistory
      .map((item) => `${item.studyStartYear}-${item.studyEndYear}`)
      .join(" & ");
    const departmentDetails = completeEducationHistory
      .map((item) => [item.department, item.degree].filter(Boolean).join(" / "))
      .join(" & ");
    const password = await bcrypt.hash(req.body.password, 12);
    const alumniId = req.alumniId;
    const transactionId = `PSG${Date.now()}${crypto.randomBytes(4).toString("hex")}`;
    const profile = {
      email,
      password,
      firstName: req.body.firstName.trim(),
      lastName: (req.body.lastName || "").trim(),
      phone: req.body.phone.trim(),
      rollNumber: (req.body.rollNumber || "").trim(),
      gender: req.body.gender,
      occupation: (req.body.occupation || "").trim(),
      department: req.body.department.trim(),
      programmeType: (req.body.programmeType || "").trim(),
      fundingType: (req.body.fundingType || "").trim(),
      degree: (req.body.degree || "").trim(),
      batchYear: req.body.batchYear.trim(),
      studyStartYear: req.body.studyStartYear.trim(),
      studyEndYear: req.body.studyEndYear.trim(),
      batchDetails,
      departmentDetails,
      educationHistory: completeEducationHistory,
      jobTitle: (req.body.jobTitle || "").trim(),
      currentCompany: (req.body.currentCompany || "").trim(),
      industry: (req.body.industry || "").trim(),
      officeContact: (req.body.officeContact || "").trim(),
      officeAddress,
      postalAddress,
      social,
      city: (req.body.city || "").trim(),
      country: (req.body.country || "").trim(),
      fullAddress: req.body.fullAddress.trim(),
      location: { type: "Point", coordinates },
      files: getFiles(req.files),
      alumniId,
    };

    pending = await PendingAlumniRegistration.create({
      alumniId,
      email,
      transactionId,
      encryptedProfile: encryptProfile(profile),
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    });

    const key = process.env.EASEBUZZ_KEY;
    const salt = process.env.EASEBUZZ_SALT;
    if (!key || !salt) {
      throw new Error("Easebuzz payment credentials are not configured");
    }

    const apiUrl = (
      process.env.API_PUBLIC_URL || `${req.protocol}://${req.get("host")}`
    ).replace(/\/+$/, "");
    const data = {
      key,
      txnid: transactionId,
      amount: fee.toFixed(2),
      email,
      phone: req.body.phone.trim(),
      firstname: req.body.firstName.trim(),
      productinfo: "PSG CAS Alumni Membership",
      udf1: "",
      udf2: "",
      udf3: "",
      udf4: "",
      udf5: "",
      udf6: "",
      udf7: "",
      udf8: "",
      udf9: "",
      udf10: "",
      surl: `${apiUrl}/api/payment/registration-response`,
      furl: `${apiUrl}/api/payment/registration-response`,
    };
    data.hash = util.generateHash(data, { key, salt });

    const gatewayResponse = await util.call(paymentUrl, data);
    const accessKey =
      typeof gatewayResponse.data === "string"
        ? gatewayResponse.data
        : gatewayResponse.data?.access_key;
    if (gatewayResponse.status !== 1 || !accessKey) {
      throw new Error("Easebuzz did not return a valid payment session");
    }

    const gatewayBase =
      paymentEnv === "prod"
        ? "https://pay.easebuzz.in/pay/"
        : "https://testpay.easebuzz.in/pay/";
    return res.status(201).json({
      message: "Continue to payment to complete alumni registration",
      transactionId,
      amount: fee,
      paymentUrl: `${gatewayBase}${encodeURIComponent(accessKey)}`,
    });
  } catch (error) {
    console.error("Membership checkout initialization failed:", error);
    try {
      if (pending) {
        await PendingAlumniRegistration.deleteOne({ _id: pending._id });
        await cleanupRequestUploads(pending.alumniId);
      } else {
        await cleanupRequestUploads(req.alumniId);
      }
    } catch (cleanupError) {
      console.error("Membership checkout cleanup failed:", cleanupError);
    }
    if (error.code === 11000) {
      return res.status(409).json({
        message: "A membership registration or payment is already in progress for this email",
      });
    }
    return res.status(error.message.startsWith("Missing required") ||
      error.message.includes("valid email") ||
      error.message.includes("at least 6 characters") ||
      error.message.includes("Complete postal address") ||
      error.message.includes("valid JSON") ||
      error.message.includes("educationHistory") ||
      error.message.includes("education entry") ||
      error.message.includes("Study years")
      ? 400
      : 500).json({ message: error.message || "Unable to initialize payment" });
  }
};

exports.getMembershipFee = (_req, res) =>
  res.json({ amount: fee, currency: "INR" });

exports.cleanupExpiredRegistrationData = async () => {
  const expired = await PendingAlumniRegistration.find({
    expiresAt: { $lte: new Date() },
  }).select("alumniId");
  for (const registration of expired) {
    try {
      await removeUploadDirectory(registration.alumniId);
      await PendingAlumniRegistration.deleteOne({ _id: registration._id });
    } catch (error) {
      console.error(
        `Unable to remove expired registration ${registration.alumniId}:`,
        error,
      );
    }
  }
};

const verifyEasebuzzHash = (response) => {
  const salt = process.env.EASEBUZZ_SALT;
  if (
    !salt ||
    !response.hash ||
    !process.env.EASEBUZZ_KEY ||
    response.key !== process.env.EASEBUZZ_KEY
  ) {
    return false;
  }
  const hashString = [
    salt,
    response.status,
    response.udf10 || "",
    response.udf9 || "",
    response.udf8 || "",
    response.udf7 || "",
    response.udf6 || "",
    response.udf5 || "",
    response.udf4 || "",
    response.udf3 || "",
    response.udf2 || "",
    response.udf1 || "",
    response.email,
    response.firstname,
    response.productinfo,
    response.amount,
    response.txnid,
    response.key,
  ].join("|");
  const expected = crypto.createHash("sha512").update(hashString).digest();
  let actual;
  try {
    actual = Buffer.from(response.hash, "hex");
  } catch {
    return false;
  }
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
};

const receiptNumber = () =>
  `PSGCAS-${new Date().getFullYear()}-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;

const frontendUrl = () =>
  (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");

const sendReceipt = async (alumni) => {
  const adminEmail = process.env.ADMIN_EMAIL;
  const from = process.env.EMAIL_USER;
  if (!adminEmail || !from) {
    throw new Error("EMAIL_USER and ADMIN_EMAIL must be configured to send receipts");
  }
  const receipt = [
    "PSG College of Arts & Science Alumni Association",
    `Receipt number: ${alumni.membershipPayment.receiptNumber}`,
    `Transaction ID: ${alumni.membershipPayment.transactionId}`,
    `Date: ${alumni.membershipPayment.transactionDate.toISOString()}`,
    `Alumnus/alumna: ${alumni.firstName} ${alumni.lastName || ""}`.trim(),
    `Email: ${alumni.email}`,
    `Amount: INR ${alumni.membershipPayment.amount.toFixed(2)}`,
  ].join("\n");
  const message = {
    from,
    subject: `Alumni membership payment receipt ${alumni.membershipPayment.receiptNumber}`,
    text: receipt,
  };
  await Promise.all([
    transporter.sendMail({ ...message, to: alumni.email }),
    transporter.sendMail({ ...message, to: adminEmail }),
  ]);
};

exports.handleRegistrationPaymentResponse = async (req, res) => {
  const response = req.body;
  try {
    if (!verifyEasebuzzHash(response)) {
      return res.status(400).send("Payment verification failed");
    }

    const pending = await PendingAlumniRegistration.findOne({
      transactionId: response.txnid,
    });
    const existingAlumni = await Alumni.findOne({
      "membershipPayment.transactionId": response.txnid,
    });
    if (String(response.status).toLowerCase() === "success") {
      if (process.env.NODE_ENV === "production" && paymentEnv !== "prod") {
        if (pending) {
          await PendingAlumniRegistration.deleteOne({ _id: pending._id });
          await removeUploadDirectory(pending.alumniId);
        }
        return res.redirect(`${frontendUrl()}/alumni/register?payment=failed`);
      }
      if (existingAlumni) {
        return res.redirect(
          `${frontendUrl()}/alumni/register?payment=success&receipt=${encodeURIComponent(existingAlumni.membershipPayment.receiptNumber)}`,
        );
      }
      if (
        !pending ||
        Number(response.amount) !== fee ||
        response.email?.toLowerCase() !== pending.email
      ) {
        return res.status(400).send("Payment registration could not be verified");
      }

      const profile = decryptProfile(pending.encryptedProfile);
      const alumni = await Alumni.create({
        ...profile,
        role: "Alumni",
        isApproved: false,
        membershipPayment: {
          status: "paid",
          amount: fee,
          currency: "INR",
          provider: "Easebuzz",
          transactionId: response.txnid,
          receiptNumber: receiptNumber(),
          transactionDate: response.addedon
            ? Number.isNaN(new Date(response.addedon).getTime())
              ? new Date()
              : new Date(response.addedon)
            : new Date(),
        },
      });
      await PendingAlumniRegistration.deleteOne({ _id: pending._id });

      try {
        await sendReceipt(alumni);
        alumni.membershipPayment.receiptEmailStatus = "sent";
        alumni.membershipPayment.receiptEmailError = undefined;
        await alumni.save();
      } catch (emailError) {
        alumni.membershipPayment.receiptEmailStatus = "failed";
        alumni.membershipPayment.receiptEmailError = emailError.message;
        await alumni.save();
        console.error(
          `Membership receipt ${alumni.membershipPayment.receiptNumber} was saved but email delivery failed:`,
          emailError,
        );
      }

      return res.redirect(
        `${frontendUrl()}/alumni/register?payment=success&receipt=${encodeURIComponent(alumni.membershipPayment.receiptNumber)}`,
      );
    }

    if (pending) {
      await PendingAlumniRegistration.deleteOne({ _id: pending._id });
      await removeUploadDirectory(pending.alumniId);
    }
    return res.redirect(`${frontendUrl()}/alumni/register?payment=failed`);
  } catch (error) {
    console.error("Membership payment callback failed:", error);
    return res.status(500).send("Unable to complete membership payment verification");
  }
};

exports.resendMembershipReceipt = async (req, res) => {
  try {
    const alumni = await Alumni.findOne({
      _id: req.params.id,
      "membershipPayment.status": "paid",
    });
    if (!alumni) return res.status(404).json({ message: "Paid member not found" });
    await sendReceipt(alumni);
    alumni.membershipPayment.receiptEmailStatus = "sent";
    alumni.membershipPayment.receiptEmailError = undefined;
    await alumni.save();
    return res.json({ message: "Receipt emailed to the alumnus and administrator" });
  } catch (error) {
    console.error("Receipt resend failed:", error);
    if (error.name === "CastError") {
      return res.status(404).json({ message: "Paid member not found" });
    }
    return res.status(500).json({ message: error.message || "Failed to resend receipt" });
  }
};
