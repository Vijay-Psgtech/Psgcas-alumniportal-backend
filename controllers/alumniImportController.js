const bcrypt = require("bcryptjs");
const Alumni = require("../models/Alumni");
const User = require("../models/Users");
const { createAlumniId } = require("../middleware/generateAlumniId");

const MAX_IMPORT_ROWS = 1000;
const HASH_BATCH_SIZE = 10;
const EMAIL_PATTERN = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
const GENDERS = new Set(["Male", "Female", "Other"]);
const SIMPLE_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "password",
  "phone",
  "rollNumber",
  "gender",
  "occupation",
  "department",
  "programmeType",
  "degree",
  "batchYear",
  "studyStartYear",
  "studyEndYear",
  "currentCompany",
  "jobTitle",
  "industry",
  "officeContact",
  "country",
  "city",
  "fullAddress",
];
const NESTED_FIELDS = {
  social: ["linkedin", "twitter", "instagram", "facebook", "website"],
  officeAddress: ["line1", "line2", "city", "state", "pincode", "country"],
};

const cleanString = (value, trim = true) => {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string" && typeof value !== "number") return null;
  const stringValue = String(value);
  return trim ? stringValue.trim() : stringValue;
};

const normalizeRecord = (record, rowNumber, scopedDepartment = "") => {
  const errors = [];
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return { rowNumber, errors: ["Row must contain an object of mapped fields"] };
  }

  const alumni = {};
  SIMPLE_FIELDS.forEach((field) => {
    if (record[field] === undefined) return;
    const value = cleanString(record[field], field !== "password");
    if (value === null) {
      errors.push(`${field} must be text`);
    } else if (value !== "") {
      alumni[field] = field === "email" ? value.toLowerCase() : value;
    }
  });

  Object.entries(NESTED_FIELDS).forEach(([group, fields]) => {
    if (record[group] === undefined) return;
    if (!record[group] || typeof record[group] !== "object" || Array.isArray(record[group])) {
      errors.push(`${group} must contain mapped text fields`);
      return;
    }

    fields.forEach((field) => {
      if (record[group][field] === undefined) return;
      const value = cleanString(record[group][field]);
      if (value === null) {
        errors.push(`${group}.${field} must be text`);
      } else if (value !== "") {
        alumni[group] ||= {};
        alumni[group][field] = value;
      }
    });
  });

  if (scopedDepartment) {
    if (alumni.department && alumni.department !== scopedDepartment) {
      errors.push("Department does not match your admin scope");
    }
    alumni.department = scopedDepartment;
  }

  if (!alumni.firstName) errors.push("First name is required");
  if (!alumni.email) errors.push("Email is required");
  else if (!EMAIL_PATTERN.test(alumni.email)) errors.push("Email is invalid");
  if (alumni.password && alumni.password.length < 6) {
    errors.push("Password must be at least 6 characters");
  }
  if (!alumni.department) errors.push("Department is required");
  if (!alumni.batchYear) errors.push("Batch year is required");

  if (alumni.gender) {
    const gender = [...GENDERS].find(
      (option) => option.toLowerCase() === alumni.gender.toLowerCase(),
    );
    if (!gender) errors.push("Gender must be Male, Female, or Other");
    else alumni.gender = gender;
  }

  return { rowNumber, alumni, errors };
};

exports.importAlumni = async (req, res) => {
  const imported = [];
  const skipped = [];
  const failed = [];
  try {
    const rows = req.body?.rows;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ message: "No alumni rows were provided" });
    }
    if (rows.length > MAX_IMPORT_ROWS) {
      return res.status(400).json({
        message: `Imports are limited to ${MAX_IMPORT_ROWS} rows per file`,
      });
    }

    let scopedDepartment = "";
    if (req.user.role === "admin") {
      const admin = await User.findById(req.user.id).select("department");
      if (!admin?.department) {
        return res.status(403).json({ message: "Admin department is not configured" });
      }
      scopedDepartment = admin.department;
    }

    const normalizedRows = rows.map((row, index) => {
      const sourceRow =
        Number.isInteger(row?._sourceRow) && row._sourceRow >= 2
          ? row._sourceRow
          : index + 2;
      return normalizeRecord(row, sourceRow, scopedDepartment);
    });

    const seenEmails = new Set();
    normalizedRows.forEach((row) => {
      if (!row.alumni?.email || row.errors.length) return;
      if (seenEmails.has(row.alumni.email)) {
        row.errors.push("Duplicate email in this file");
      } else {
        seenEmails.add(row.alumni.email);
      }
    });

    const candidates = normalizedRows.filter((row) => row.errors.length === 0);
    const existing = candidates.length
      ? await Alumni.find({ email: { $in: candidates.map((row) => row.alumni.email) } })
          .collation({ locale: "en", strength: 2 })
          .select("email")
          .lean()
      : [];
    const existingEmails = new Set(existing.map((alumni) => alumni.email.toLowerCase()));
    skipped.push(...candidates
      .filter((row) => existingEmails.has(row.alumni.email))
      .map((row) => ({ row: row.rowNumber, email: row.alumni.email, reason: "Email already exists" })));
    const existingEmailSet = new Set(skipped.map((row) => row.email));
    const readyRows = candidates.filter((row) => !existingEmailSet.has(row.alumni.email));
    failed.push(...normalizedRows
      .filter((row) => row.errors.length)
      .map((row) => ({ row: row.rowNumber, errors: row.errors })));

    for (let offset = 0; offset < readyRows.length; offset += HASH_BATCH_SIZE) {
      const preparedRows = await Promise.all(
        readyRows.slice(offset, offset + HASH_BATCH_SIZE).map(async (row) => ({
          row,
          alumniId: await createAlumniId(),
          hashedPassword: row.alumni.password
            ? await bcrypt.hash(row.alumni.password, 10)
            : undefined,
        })),
      );

      for (const { row, alumniId, hashedPassword } of preparedRows) {
        try {
          const alumni = await Alumni.create({
            ...row.alumni,
            alumniId,
            ...(hashedPassword ? { password: hashedPassword } : {}),
            isApproved: true,
            isAdmin: false,
            role: "Alumni",
            membershipStatus: "NOT_APPLIED",
            location: { type: "Point", coordinates: [0, 0] },
          });
          imported.push({ row: row.rowNumber, alumniId: alumni.alumniId, email: alumni.email });
        } catch (error) {
          if (
            error.code === 11000 &&
            (error.keyPattern?.email || error.keyValue?.email)
          ) {
            skipped.push({
              row: row.rowNumber,
              email: row.alumni.email,
              reason: "Email already exists",
            });
          } else if (error.name === "ValidationError") {
            failed.push({
              row: row.rowNumber,
              errors: Object.values(error.errors).map((fieldError) => fieldError.message),
            });
          } else {
            throw error;
          }
        }
      }
    }

    return res.status(200).json({
      message: "Alumni import completed",
      importedCount: imported.length,
      skippedCount: skipped.length,
      failedCount: failed.length,
      imported,
      skipped,
      failed,
    });
  } catch (error) {
    console.error("Alumni import error:", error);
    return res.status(500).json({
      message: "Alumni import failed; some records may have been created",
      error: error.message,
      importedCount: imported.length,
      skippedCount: skipped.length,
      failedCount: failed.length,
      imported,
      skipped,
      failed,
    });
  }
};
