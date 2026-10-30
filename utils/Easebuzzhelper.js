// ─────────────────────────────────────────────────────────────────────────────
// utils/easebuzzHelper.js  —  Hash generation & verification for Easebuzz
// ─────────────────────────────────────────────────────────────────────────────
// Easebuzz uses SHA-512 HMAC hashing for request integrity.
//
// INITIATE hash string:
//   key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT
//
// RESPONSE verification hash string (reverse):
//   SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key
// ─────────────────────────────────────────────────────────────────────────────

const crypto = require("crypto");
const { EASEBUZZ_CONFIG } = require("../config/easebuzz");

/**
 * Generate SHA-512 hash for initiating a payment.
 * @param {Object} params  – all required Easebuzz fields
 * @returns {string}       – hex SHA-512 hash
 */
const generateInitiateHash = (params) => {
  const {
    key, txnid, amount, productinfo, firstname, email,
    udf1 = "", udf2 = "", udf3 = "", udf4 = "", udf5 = "",
  } = params;

  const hashString =
    `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|` +
    `${udf1}|${udf2}|${udf3}|${udf4}|${udf5}||||||${EASEBUZZ_CONFIG.salt}`;

  return crypto.createHash("sha512").update(hashString).digest("hex");
};

/**
 * Verify the hash returned by Easebuzz on the response webhook.
 * @param {Object} responseParams  – full response body from Easebuzz
 * @returns {boolean}
 */
const verifyResponseHash = (responseParams) => {
  const {
    key, txnid, amount, productinfo, firstname, email,
    udf1 = "", udf2 = "", udf3 = "", udf4 = "", udf5 = "",
    status, hash,
  } = responseParams;

  const hashString =
    `${EASEBUZZ_CONFIG.salt}|${status}||||||` +
    `${udf5}|${udf4}|${udf3}|${udf2}|${udf1}|` +
    `${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;

  const computedHash = crypto
    .createHash("sha512")
    .update(hashString)
    .digest("hex");

  return computedHash === hash;
};

/**
 * Generate a unique transaction ID.
 * Format: ALM-<module_prefix>-<timestamp>-<random5>
 * @param {"MEM"|"DON"} prefix
 */
const generateTxnId = (prefix = "TXN") => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `ALM-${prefix}-${timestamp}-${random}`;
};

/**
 * Format amount to exactly 2 decimal places (Easebuzz requirement).
 * @param {number|string} amount
 * @returns {string}
 */
const formatAmount = (amount) => parseFloat(amount).toFixed(2);

module.exports = {
  generateInitiateHash,
  verifyResponseHash,
  generateTxnId,
  formatAmount,
};