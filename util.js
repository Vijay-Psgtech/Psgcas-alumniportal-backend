const crypto = require("node:crypto");
const sha512 = require("js-sha512");

let curl_call = async function (url, data, method = "POST") {
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(data),
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const error = new Error(`Request failed with status ${response.status}`);
    error.response = payload;
    throw error;
  }

  return payload;
};


let validate_email = function (mail) {
  return (
    typeof mail === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)
  );
}

let validate_phone = function (number) {
  return typeof number === "string" && /^\d{10}$/.test(number);
}
let generateHash = function (data, config) {

  var hashstring = config.key + "|" + data.txnid + "|" + data.amount + "|" + data.productinfo + "|" + data.name + "|" + data.email +
    "|" + data.udf1 + "|" + data.udf2 + "|" + data.udf3 + "|" + data.udf4 + "|" + data.udf5 + "|" + data.udf6 + "|" + data.udf7 + "|" + data.udf8 + "|" + data.udf9 + "|" + data.udf10;
  hashstring += "|" + config.salt;
  data.hash = sha512.sha512(hashstring);
  return (data.hash);
}

let validate_float = function (number) {
  return parseFloat(number) === number
}

function get_query_url(env) {
  let url_link = '';
  if (env == 'prod') {
    url_link = "https://dashboard.easebuzz.in/";
  } else if (env == 'test') {
    url_link = "https://testdashboard.easebuzz.in/";
  }

  return url_link;
}

function verifyEasebuzzHash(response, salt, merchantKey) {
  if (
    !response ||
    typeof response !== "object" ||
    Array.isArray(response) ||
    typeof salt !== "string" ||
    !salt ||
    typeof merchantKey !== "string" ||
    !merchantKey ||
    response.key !== merchantKey ||
    ["status", "email", "firstname", "productinfo", "amount", "txnid"].some(
      (field) =>
        typeof response[field] !== "string" || !response[field].trim(),
    ) ||
    typeof response.hash !== "string" ||
    !/^[a-f\d]{128}$/i.test(response.hash)
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
  const expected = Buffer.from(
    crypto.createHash("sha512").update(hashString).digest("hex"),
    "hex",
  );
  const actual = Buffer.from(response.hash, "hex");

  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

exports.validate_mail = validate_email;
exports.validate_phone = validate_phone;
exports.generateHash = generateHash;
exports.validate_float = validate_float;
exports.call = curl_call;
exports.get_base_url = get_query_url;
exports.verify_easebuzz_hash = verifyEasebuzzHash;
