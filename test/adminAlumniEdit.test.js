const assert = require("node:assert/strict");
const { test } = require("node:test");
const Alumni = require("../models/Alumni");
const { updateAlumniByAdmin } = require("../controllers/adminAlumniController");

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

test("superadmin can correct an alumni member's name", async () => {
  const originalFindOneAndUpdate = Alumni.findOneAndUpdate;
  let savedFilter;
  let savedUpdates;
  Alumni.findOneAndUpdate = (filter, updates) => {
    savedFilter = filter;
    savedUpdates = updates;
    return {
      select: async () => ({
        _id: "alumni-id",
        firstName: updates.firstName,
        lastName: updates.lastName,
      }),
    };
  };
  const res = makeResponse();

  try {
    await updateAlumniByAdmin(
      {
        adminDepartment: null,
        params: { id: "alumni-id" },
        body: { firstName: "Corrected", lastName: "Name" },
      },
      res,
    );
  } finally {
    Alumni.findOneAndUpdate = originalFindOneAndUpdate;
  }

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.alumni.firstName, "Corrected");
  assert.equal(res.body.alumni.lastName, "Name");
  assert.equal(savedFilter._id, "alumni-id");
  assert.equal(savedFilter.role, "Alumni");
  assert.equal(savedFilter["membershipPayment.status"], "paid");
  assert.equal(savedUpdates.firstName, "Corrected");
});
