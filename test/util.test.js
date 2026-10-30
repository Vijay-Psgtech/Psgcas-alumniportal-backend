const assert = require("node:assert/strict");
const { test } = require("node:test");
const sha512 = require("js-sha512");
const util = require("../util");

test("validates email addresses", () => {
  assert.equal(util.validate_mail("alumni@example.com"), true);
  assert.equal(util.validate_mail("alumni.name+tag@example.co.in"), true);
  assert.equal(util.validate_mail("invalid-email"), false);
  assert.equal(util.validate_mail("alumni@example"), false);
  assert.equal(util.validate_mail("alumni @example.com"), false);
});

test("validates ten-digit phone numbers", () => {
  assert.equal(util.validate_phone("9876543210"), true);
  assert.equal(util.validate_phone("123456789"), false);
  assert.equal(util.validate_phone("12345678901"), false);
  assert.equal(util.validate_phone("12345abc90"), false);
  assert.equal(util.validate_phone(""), false);
});

test("generates and stores the payment hash", () => {
  const data = {
    txnid: "txn-123",
    amount: "600.00",
    productinfo: "Membership",
    name: "Alumni",
    email: "alumni@example.com",
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
  };
  const config = { key: "merchant-key", salt: "merchant-salt" };
  const expected = sha512.sha512(
    [
      "merchant-key",
      "txn-123",
      "600.00",
      "Membership",
      "Alumni",
      "alumni@example.com",
      ...Array(10).fill(""),
      "merchant-salt",
    ].join("|"),
  );

  assert.equal(util.generateHash(data, config), expected);
  assert.equal(data.hash, expected);
});

test("verifies well-formed Easebuzz responses against the configured merchant", () => {
  const response = {
    status: "success",
    email: "alumni@example.com",
    firstname: "Alumni",
    productinfo: "Membership",
    amount: "600.00",
    txnid: "txn-123",
    key: "merchant-key",
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
  };
  const hashString = [
    "merchant-salt",
    response.status,
    ...Array(10).fill(""),
    response.email,
    response.firstname,
    response.productinfo,
    response.amount,
    response.txnid,
    response.key,
  ].join("|");
  response.hash = sha512.sha512(hashString);

  assert.equal(
    util.verify_easebuzz_hash(response, "merchant-salt", "merchant-key"),
    true,
  );
  assert.equal(
    util.verify_easebuzz_hash(response, "wrong-salt", "merchant-key"),
    false,
  );
  assert.equal(
    util.verify_easebuzz_hash(response, "merchant-salt", "wrong-key"),
    false,
  );
});

test("rejects malformed or incomplete Easebuzz responses", () => {
  assert.equal(util.verify_easebuzz_hash(null, "salt", "key"), false);
  assert.equal(util.verify_easebuzz_hash({}, "salt", "key"), false);
  assert.equal(
    util.verify_easebuzz_hash({ hash: "not-a-hash" }, "salt", "key"),
    false,
  );
  assert.equal(
    util.verify_easebuzz_hash(
      {
        status: "success",
        email: "alumni@example.com",
        firstname: "Alumni",
        productinfo: "Membership",
        amount: "600.00",
        txnid: "txn-123",
        key: "key",
        hash: "a".repeat(128),
      },
      "",
      "key",
    ),
    false,
  );
});

test("selects a gateway base URL only for supported environments", () => {
  assert.equal(util.get_base_url("prod"), "https://dashboard.easebuzz.in/");
  assert.equal(
    util.get_base_url("test"),
    "https://testdashboard.easebuzz.in/",
  );
  assert.equal(util.get_base_url("development"), "");
});
