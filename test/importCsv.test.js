const assert = require("node:assert/strict");
const { test } = require("node:test");
const Alumni = require("../models/Alumni");
const { importPaidAlumniCsv } = require("../controllers/adminAlumniController");

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

test("imports legacy alumni exports using graduation, course, and residence headings", async () => {
  const headers = [
    "First Name",
    "Last Name",
    "E-mail",
    "Role",
    "Gender",
    "Year of Joining",
    "Year of Graduation",
    "Course/Degree",
    "House",
    "Mail Unsubscribe Category",
    "Membership",
    "Membership Number",
    "Skills",
    "Current Designation",
    "Current Company",
    "Other Work",
    "Work Industry",
    "Other Education",
    "Auth/Unauth",
    "Institute",
    "Phone",
    "secondary_email",
    "Joined",
    "Last Profile Update",
    "Last Login Time",
    "Active Account Time",
    "Current City",
    "Current Country",
    "Hometown",
    "Hometown Country",
    "Roll Number",
    "Unique Profile ID",
    "Profile URL",
    "Current Residence",
    "Current Office",
    "Permanent Residence",
    "DoB",
    "Marital Status",
  ];
  const values = [
    "Ada",
    "Lovelace",
    "ada@example.com",
    "Alumni",
    "Female",
    "1830",
    "1832",
    "Mathematics",
    "",
    "",
    "",
    "",
    "",
    "Analyst",
    "Analytical Engine",
    "",
    "",
    "",
    "",
    "PSG CAS",
    "9876543210",
    "",
    "",
    "",
    "",
    "",
    "London",
    "United Kingdom",
    "",
    "",
    "R-123",
    "legacy-123",
    "",
    "12 St James's Square",
    "Office address",
    "12 St James's Square",
    "",
    "",
  ];
  const csv = `${headers.join(",")}\r\n${values.map((value) => `"${value.replace(/"/g, '""')}"`).join(",")}`;
  const originalFind = Alumni.find;
  const originalBulkWrite = Alumni.bulkWrite;
  let operations;
  Alumni.find = () => ({
    select() {
      return this;
    },
    lean: async () => [],
  });
  Alumni.bulkWrite = async (value) => {
    operations = value;
    return { upsertedCount: value.length, modifiedCount: 0 };
  };
  const res = makeResponse();

  try {
    await importPaidAlumniCsv(
      {
        file: {
          originalname: "legacy-alumni.csv",
          buffer: Buffer.from(csv),
        },
      },
      res,
    );
  } finally {
    Alumni.find = originalFind;
    Alumni.bulkWrite = originalBulkWrite;
  }

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.imported, 1);
  const imported = operations[0].updateOne.update.$set;
  assert.equal(imported.firstName, "Ada");
  assert.equal(imported.lastName, "Lovelace");
  assert.equal(imported.department, "Mathematics");
  assert.equal(imported.degree, "");
  assert.equal(imported.batchDetails, "1830-1832");
  assert.equal(imported.studyStartYear, "1830");
  assert.equal(imported.studyEndYear, "1832");
  assert.equal(imported.postalAddress.line1, "12 St James's Square");
  assert.equal(imported.postalAddress.city, "London");
  assert.equal(imported.postalAddress.country, "United Kingdom");
  assert.equal(imported.jobTitle, "Analyst");
  assert.equal(imported.currentCompany, "Analytical Engine");
});
