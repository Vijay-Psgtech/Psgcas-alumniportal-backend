// ─────────────────────────────────────────────────────────────────────────────
// config/easebuzz.js  —  Easebuzz Gateway Configuration
// ─────────────────────────────────────────────────────────────────────────────

const EASEBUZZ_CONFIG = {
  key: process.env.EASEBUZZ_KEY,
  salt: process.env.EASEBUZZ_SALT,
  env: process.env.EASEBUZZ_ENV || "test",           // "test" | "prod"

  // API Endpoints
  initiatePaymentUrl:
    process.env.EASEBUZZ_ENV === "prod"
      ? "https://pay.easebuzz.in/payment/initiateLink"
      : "https://testpay.easebuzz.in/payment/initiateLink",

  // Your hosted success / failure pages  (Express will handle these)
  successUrl: `${process.env.SERVER_BASE_URL}/api/payment/response`,
  failureUrl: `${process.env.SERVER_BASE_URL}/api/payment/response`,

  // Frontend redirect after verification
  frontendSuccessUrl: `${process.env.CLIENT_BASE_URL}/payment/success`,
  frontendFailureUrl: `${process.env.CLIENT_BASE_URL}/payment/failure`,
};

// Validate that required keys exist
const validate = () => {
  if (!EASEBUZZ_CONFIG.key || !EASEBUZZ_CONFIG.salt) {
    throw new Error(
      "EASEBUZZ_KEY and EASEBUZZ_SALT must be set in environment variables."
    );
  }
};

module.exports = { EASEBUZZ_CONFIG, validate };