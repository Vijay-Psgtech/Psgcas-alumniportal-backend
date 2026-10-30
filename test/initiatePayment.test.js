const assert = require("node:assert/strict");
const { test } = require("node:test");
const initiatePayment = require("../initiate_payment").initiate_payment;
const util = require("../util");

const makeResponse = () => ({
  statusCode: 200,
  body: undefined,
  redirectUrl: undefined,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
  redirect(url) {
    this.redirectUrl = url;
    return this;
  },
  render(view, data) {
    this.view = view;
    this.renderData = data;
    return this;
  },
});

const validPayment = () => ({
  name: "Alumni",
  amount: "600.00",
  txnid: "txn-123",
  email: "alumni@example.com",
  phone: "9876543210",
  productinfo: "Membership",
  surl: "https://alumni.example.com/payment/success",
  furl: "https://alumni.example.com/payment/failed",
});

const config = {
  key: "merchant-key",
  salt: "merchant-salt",
  env: "test",
  enable_iframe: "0",
};

test("rejects invalid payment input without calling the gateway", async () => {
  const originalCall = util.call;
  let gatewayCalled = false;
  util.call = async () => {
    gatewayCalled = true;
  };
  const res = makeResponse();

  try {
    await initiatePayment({ ...validPayment(), phone: "123" }, config, res);
  } finally {
    util.call = originalCall;
  }

  assert.equal(gatewayCalled, false);
  assert.equal(res.statusCode, 400);
});

test("returns a gateway error instead of leaving payment initiation pending", async () => {
  const originalCall = util.call;
  util.call = async () => {
    throw new Error("Gateway unavailable");
  };
  const res = makeResponse();

  try {
    await initiatePayment(validPayment(), config, res);
  } finally {
    util.call = originalCall;
  }

  assert.equal(res.statusCode, 502);
  assert.equal(res.body.message, "Unable to initiate payment");
});

test("redirects only after the gateway returns an access key", async () => {
  const originalCall = util.call;
  util.call = async () => ({ data: "access key/123" });
  const res = makeResponse();

  try {
    await initiatePayment(validPayment(), config, res);
  } finally {
    util.call = originalCall;
  }

  assert.equal(res.redirectUrl, "https://testpay.easebuzz.in/pay/access%20key%2F123");
});

test("rejects a gateway response without an access key", async () => {
  const originalCall = util.call;
  util.call = async () => ({ data: "" });
  const res = makeResponse();

  try {
    await initiatePayment(validPayment(), config, res);
  } finally {
    util.call = originalCall;
  }

  assert.equal(res.statusCode, 502);
  assert.equal(res.body.message, "Payment gateway returned an invalid response");
});
