const util = require("./util.js");

const initiate_payment = async function (data, config, res) {
  const requiredFields = [
    "name",
    "amount",
    "txnid",
    "email",
    "phone",
    "productinfo",
    "surl",
    "furl",
  ];
  const missingField = requiredFields.find(
    (field) =>
      typeof data?.[field] !== "string" ||
      data[field].trim().length === 0,
  );
  if (missingField) {
    return res.status(400).json({
      status: 0,
      data: `Mandatory Parameter ${missingField} cannot be empty`,
    });
  }

  if (!/^\d+\.\d{1,2}$/.test(data.amount) || Number(data.amount) <= 0) {
    return res.status(400).json({
      status: 0,
      data: "Amount must be greater than zero and have up to two decimal places",
    });
  }
  if (!util.validate_mail(data.email)) {
    return res.status(400).json({
      status: 0,
      data: "Email validation failed",
    });
  }
  if (!util.validate_phone(data.phone)) {
    return res.status(400).json({
      status: 0,
      data: "Phone validation failed",
    });
  }

  let baseUrl;
  if (config.env === "prod") {
    baseUrl = "https://pay.easebuzz.in/";
  } else if (config.env === "test") {
    baseUrl = "https://testpay.easebuzz.in/";
  } else {
    return res.status(503).json({
      status: 0,
      message: "Payment environment is not supported",
    });
  }

  if (!config.key || !config.salt) {
    return res.status(503).json({
      status: 0,
      message: "Payment gateway is not configured",
    });
  }

  for (const field of ["surl", "furl"]) {
    try {
      const callbackUrl = new URL(data[field]);
      if (!["http:", "https:"].includes(callbackUrl.protocol)) {
        throw new Error("Unsupported callback protocol");
      }
    } catch {
      return res.status(400).json({
        status: 0,
        data: `${field} must be a valid HTTP or HTTPS URL`,
      });
    }
  }

  const udfFields = Array.from({ length: 10 }, (_, index) => `udf${index + 1}`);
  const paymentData = {
    key: config.key,
    txnid: data.txnid,
    amount: data.amount,
    email: data.email,
    phone: data.phone,
    firstname: data.name,
    productinfo: data.productinfo,
    ...Object.fromEntries(udfFields.map((field) => [field, data[field] || ""])),
    surl: data.surl,
    furl: data.furl,
  };
  paymentData.hash = util.generateHash(
    { ...paymentData, name: data.name },
    config,
  );

  for (const field of [
    "unique_id",
    "split_payments",
    "sub_merchant_id",
    "customer_authentication_id",
  ]) {
    if (typeof data[field] === "string" && data[field]) {
      paymentData[field] = data[field];
    }
  }

  try {
    const response = await util.call(
      `${baseUrl}payment/initiateLink`,
      paymentData,
    );
    if (typeof response.data !== "string" || !response.data.trim()) {
      console.error("Easebuzz returned an invalid payment access key");
      return res.status(502).json({
        status: 0,
        message: "Payment gateway returned an invalid response",
      });
    }

    if (config.enable_iframe === 0 || config.enable_iframe === "0") {
      return res.redirect(
        `${baseUrl}pay/${encodeURIComponent(response.data)}`,
      );
    }

    return res.render("enable_iframe.html", {
      key: config.key,
      access_key: response.data,
    });
  } catch (error) {
    console.error("Easebuzz payment initiation failed:", error.message);
    return res.status(502).json({
      status: 0,
      message: "Unable to initiate payment",
    });
  }
};

exports.initiate_payment = initiate_payment;
