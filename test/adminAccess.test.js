const assert = require("node:assert/strict");
const { test } = require("node:test");
const jwt = require("jsonwebtoken");
const adminAlumniScope = require("../middleware/adminAlumniScope");
const {
  authMiddleware,
  superAdminMiddleware,
} = require("../middleware/auth");

const makeResponse = () => ({
  statusCode: 200,
  body: undefined,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test("department admins are restricted to their assigned department", () => {
  const req = { user: { role: "admin", department: "  Biology  " } };
  const res = makeResponse();
  let continued = false;

  adminAlumniScope(req, res, () => {
    continued = true;
  });

  assert.equal(continued, true);
  assert.equal(req.adminDepartment, "Biology");
});

test("department admins without an assigned department are denied", () => {
  const req = { user: { role: "admin" } };
  const res = makeResponse();
  let continued = false;

  adminAlumniScope(req, res, () => {
    continued = true;
  });

  assert.equal(continued, false);
  assert.equal(res.statusCode, 403);
});

test("superadmins retain unrestricted alumni scope", () => {
  const req = { user: { role: "superadmin" } };
  const res = makeResponse();
  let continued = false;

  adminAlumniScope(req, res, () => {
    continued = true;
  });

  assert.equal(continued, true);
  assert.equal(req.adminDepartment, null);
});

test("payment administration middleware rejects unauthenticated callers", () => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "test-secret";
  const req = { headers: {} };
  const res = makeResponse();
  let continued = false;

  try {
    authMiddleware(req, res, () => {
      continued = true;
    });
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }

  assert.equal(continued, false);
  assert.equal(res.statusCode, 401);
});

test("payment administration middleware rejects non-superadmins", () => {
  const req = { user: { role: "admin" } };
  const res = makeResponse();
  let continued = false;

  superAdminMiddleware(req, res, () => {
    continued = true;
  });

  assert.equal(continued, false);
  assert.equal(res.statusCode, 403);
});

test("payment administration middleware permits superadmins", () => {
  const req = { user: { role: "superadmin" } };
  const res = makeResponse();
  let continued = false;

  superAdminMiddleware(req, res, () => {
    continued = true;
  });

  assert.equal(continued, true);
});

test("admin JWT authentication preserves the signed department claim", () => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "test-secret";
  const req = { headers: { authorization: "" } };
  const res = makeResponse();
  let continued = false;

  try {
    const token = jwt.sign(
      { id: "admin-id", role: "admin", department: "Biology" },
      process.env.JWT_SECRET,
    );
    req.headers.authorization = `Bearer ${token}`;
    authMiddleware(req, res, () => {
      continued = true;
    });
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }

  assert.equal(continued, true);
  assert.equal(req.user.department, "Biology");
  assert.equal(req.adminDepartment, undefined);
});
