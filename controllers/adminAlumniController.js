const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const Alumni = require("../models/Alumni");

const csvCell = (value) => {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

const addressText = (address = {}) =>
  [
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.pincode,
    address.country,
  ]
    .filter(Boolean)
    .join(", ");

const getAlumniName = (alumni) =>
  [alumni.firstName, alumni.lastName].filter(Boolean).join(" ");

const getEducationHistory = (alumni) =>
  alumni.educationHistory?.length
    ? alumni.educationHistory
    : [
        {
          department: alumni.department,
          degree: alumni.degree,
          studyStartYear: alumni.studyStartYear,
          studyEndYear: alumni.studyEndYear,
        },
      ];

exports.exportPaidAlumniCsv = async (req, res) => {
  try {
    const filter = {
      role: "Alumni",
      "membershipPayment.status": "paid",
    };
    if (req.query.department) filter.department = req.query.department;
    if (req.query.batchYear) filter.batchYear = req.query.batchYear;
    if (req.query.search) {
      const search = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { currentCompany: { $regex: search, $options: "i" } },
      ];
    }

    const alumni = await Alumni.find(filter)
      .select("-password")
      .sort({ "membershipPayment.transactionDate": -1 });
    const headers = [
      "Transaction ID/Reference",
      "Receipt Number",
      "Payment Source",
      "Transaction Date and Time",
      "Alumni Name",
      "Batch Details",
      "Department/Subject",
      "Email Address",
      "Contact Number",
      "Complete Postal Address",
      "Current Designation",
      "Organization/Institution/Company",
      "Professional Location",
      "Postal Address Line 1",
      "Postal Address Line 2",
      "City",
      "State",
      "PIN Code",
      "Country",
      "Professional Location Line 2",
      "Professional City",
      "Professional State",
      "Professional PIN Code",
      "Professional Country",
    ];
    const rows = alumni.map((person) => [
      person.membershipPayment?.transactionId,
      person.membershipPayment?.receiptNumber,
      person.membershipPayment?.provider,
      person.membershipPayment?.transactionDate?.toISOString(),
      getAlumniName(person),
      person.batchDetails ||
        getEducationHistory(person)
          .map((item) => [item.studyStartYear, item.studyEndYear].filter(Boolean).join("-"))
          .join(" & "),
      person.departmentDetails ||
        getEducationHistory(person)
          .map((item) => [item.department, item.degree].filter(Boolean).join(" / "))
          .join(" & "),
      person.email,
      person.phone,
      addressText(person.postalAddress) || person.fullAddress,
      person.jobTitle,
      person.currentCompany,
      addressText(person.officeAddress),
      person.postalAddress?.line1,
      person.postalAddress?.line2,
      person.postalAddress?.city,
      person.postalAddress?.state,
      person.postalAddress?.pincode,
      person.postalAddress?.country,
      person.officeAddress?.line2,
      person.officeAddress?.city,
      person.officeAddress?.state,
      person.officeAddress?.pincode,
      person.officeAddress?.country,
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="paid-alumni-members.csv"',
    );
    return res.send(`\uFEFF${csv}`);
  } catch (error) {
    console.error("Alumni CSV export failed:", error);
    return res.status(500).json({ message: "Failed to export alumni records" });
  }
};

exports.findAlumniDuplicates = async (_req, res) => {
  try {
    const duplicates = await Alumni.aggregate([
      { $match: { role: "Alumni", "membershipPayment.status": "paid" } },
      {
        $group: {
          _id: {
            firstName: { $toLower: "$firstName" },
            lastName: { $toLower: { $ifNull: ["$lastName", ""] } },
            batchYear: "$batchYear",
            department: "$department",
          },
          records: {
            $push: {
              _id: "$_id",
              alumniId: "$alumniId",
              firstName: "$firstName",
              lastName: "$lastName",
              email: "$email",
              phone: "$phone",
              batchYear: "$batchYear",
              department: "$department",
              postalAddress: "$postalAddress",
              isApproved: "$isApproved",
            },
          },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
      { $project: { _id: 0, records: 1 } },
    ]);
    return res.json({ duplicates });
  } catch (error) {
    console.error("Alumni duplicate lookup failed:", error);
    return res.status(500).json({ message: "Failed to find duplicate records" });
  }
};

exports.updateAlumniByAdmin = async (req, res) => {
  try {
    const allowedFields = [
      "firstName",
      "lastName",
      "email",
      "phone",
      "department",
      "programmeType",
      "fundingType",
      "degree",
      "batchYear",
      "studyStartYear",
      "studyEndYear",
      "batchDetails",
      "departmentDetails",
      "occupation",
      "jobTitle",
      "currentCompany",
      "industry",
      "fullAddress",
      "postalAddress",
      "officeAddress",
    ];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([field]) => allowedFields.includes(field)),
    );
    if (updates.batchDetails || updates.departmentDetails) {
      if (!updates.batchDetails || !updates.departmentDetails) {
        return res.status(400).json({
          message: "Batch details and department/subject details must be updated together",
        });
      }
      const batches = updates.batchDetails.split(/\s*&\s*/);
      const subjects = updates.departmentDetails.split(/\s*&\s*/);
      if (batches.length !== subjects.length) {
        return res.status(400).json({
          message: "Each batch must have a matching department/subject entry",
        });
      }
      const educationHistory = batches.map((batch, index) => {
        const years = batch.match(/^\s*(\d{4})\s*-\s*(\d{4})\s*$/);
        const [department, ...degreeParts] = subjects[index].split(" / ");
        if (!years || !department?.trim()) {
          throw new Error("Education details must use YYYY-YYYY and Department / Degree format");
        }
        return {
          department: department.trim(),
          degree: degreeParts.join(" / ").trim(),
          studyStartYear: years[1],
          studyEndYear: years[2],
        };
      });
      updates.educationHistory = educationHistory;
      updates.department = educationHistory[0].department;
      updates.degree = educationHistory[0].degree;
      updates.studyStartYear = educationHistory[0].studyStartYear;
      updates.studyEndYear = educationHistory[0].studyEndYear;
      updates.batchYear = educationHistory[0].studyEndYear;
    }
    const alumni = await Alumni.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).select("-password");
    if (!alumni) return res.status(404).json({ message: "Alumni not found" });
    return res.json({ message: "Alumni updated successfully", alumni });
  } catch (error) {
    console.error("Admin alumni update failed:", error);
    return res.status(400).json({ message: error.message || "Failed to update alumni" });
  }
};

exports.deleteAlumniByAdmin = async (req, res) => {
  try {
    const alumni = await Alumni.findByIdAndDelete(req.params.id);
    if (!alumni) return res.status(404).json({ message: "Alumni not found" });
    return res.json({ message: "Alumni record deleted successfully" });
  } catch (error) {
    console.error("Admin alumni deletion failed:", error);
    return res.status(500).json({ message: "Failed to delete alumni record" });
  }
};

const detectCsvDelimiter = (text) => {
  const candidates = [",", ";", "\t", "|"];
  const counts = new Map(candidates.map((delimiter) => [delimiter, 0]));
  let quoted = false;
  let sampledLines = 0;
  let lineCounts = new Map(candidates.map((delimiter) => [delimiter, 0]));

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted && char === '"' && text[index + 1] === '"') {
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if ([...lineCounts.values()].some((count) => count > 0)) {
        sampledLines += 1;
        for (const delimiter of candidates) {
          counts.set(delimiter, counts.get(delimiter) + lineCounts.get(delimiter));
        }
      }
      lineCounts = new Map(candidates.map((delimiter) => [delimiter, 0]));
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      if (sampledLines >= 25) break;
    } else if (!quoted && lineCounts.has(char)) {
      lineCounts.set(char, lineCounts.get(char) + 1);
    }
  }

  for (const delimiter of candidates) {
    counts.set(delimiter, counts.get(delimiter) + lineCounts.get(delimiter));
  }

  return candidates.reduce(
    (best, delimiter) =>
      counts.get(delimiter) > counts.get(best) ? delimiter : best,
    ",",
  );
};

const decodeCsv = (buffer) => {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.subarray(2).toString("utf16le");
  }
  if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    const content = Buffer.from(buffer.subarray(2));
    for (let index = 0; index + 1 < content.length; index += 2) {
      [content[index], content[index + 1]] = [content[index + 1], content[index]];
    }
    return content.toString("utf16le");
  }
  return buffer.toString("utf8").replace(/^\uFEFF/, "");
};

const parseCsv = (text, delimiter = detectCsvDelimiter(text)) => {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted && char === '"' && text[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (quoted) throw new Error("CSV contains an unclosed quoted field");
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
};

const normalizeCsvHeader = (header) =>
  header.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

const csvHeaderAliases = {
  "Transaction ID/Reference": [
    "transaction id",
    "transaction reference",
    "transaction id/reference",
    "transactionid",
    "txnid",
    "payment reference",
    "payment id",
  ],
  "Receipt Number": ["receipt", "receipt no", "receipt number", "receipt id"],
  "Transaction Date and Time": [
    "transaction date",
    "payment date",
    "transaction date and time",
    "date/time",
    "addedon",
  ],
  "Alumni Name": ["name", "alumni name", "full name", "fullname"],
  "Batch Details": [
    "batch",
    "batch year",
    "batchyear",
    "batch details",
    "year of joining and completion",
  ],
  "Department/Subject": [
    "department",
    "subject",
    "programme",
    "program",
    "department/subject",
  ],
  "Email Address": ["email", "email id", "email address"],
  "Contact Number": ["phone", "mobile", "contact", "phone number", "contact number"],
  "Complete Postal Address": [
    "address",
    "full address",
    "postal address",
    "residential address",
    "complete postal address",
  ],
  "Current Designation": [
    "designation",
    "job title",
    "jobtitle",
    "occupation",
    "current designation",
  ],
  "Organization/Institution/Company": [
    "organization",
    "organisation",
    "institution",
    "company",
    "current company",
    "employer",
    "organization/institution/company",
  ],
  "Professional Location": [
    "professional location",
    "office location",
    "work location",
    "location",
  ],
  "Postal Address Line 1": ["address line 1", "postal address line 1", "line1"],
  "Postal Address Line 2": ["address line 2", "postal address line 2", "line2"],
  "City": ["city", "postal city"],
  "State": ["state", "postal state"],
  "PIN Code": ["pin", "pin code", "pincode", "postal code", "zip code"],
  "Country": ["country", "postal country"],
  "Professional Location Line 2": ["office address line 2", "professional location line 2"],
  "Professional City": ["office city", "professional city"],
  "Professional State": ["office state", "professional state"],
  "Professional PIN Code": ["office pin", "office pincode", "professional pin code"],
  "Professional Country": ["office country", "professional country"],
};

const findCsvHeaderRow = (rows) => {
  const knownHeaders = Object.entries(csvHeaderAliases).map(
    ([canonical, aliases]) => [
      normalizeCsvHeader(canonical),
      ...aliases.map(normalizeCsvHeader),
    ],
  );
  let bestIndex = 0;
  let bestScore = 0;

  rows.slice(0, 25).forEach((row, index) => {
    const candidate = new Set(row.map(normalizeCsvHeader));
    const score = knownHeaders.filter((aliases) =>
      aliases.some((alias) => candidate.has(alias)),
    ).length;
    if (score > bestScore) {
      bestIndex = index;
      bestScore = score;
    }
  });

  return bestScore >= 3 ? bestIndex : 0;
};

exports.importPaidAlumniCsv = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: "Choose a CSV file to import" });
    }
    if (!req.file.originalname.toLowerCase().endsWith(".csv")) {
      return res.status(400).json({ message: "Only CSV files can be imported" });
    }
    const rows = parseCsv(decodeCsv(req.file.buffer));
    if (rows.length < 2) {
      return res.status(400).json({ message: "CSV contains no alumni rows" });
    }
    const headerRowIndex = findCsvHeaderRow(rows);
    const headerRow = rows[headerRowIndex];
    const dataRows = rows.slice(headerRowIndex + 1);
    if (!dataRows.length) {
      return res.status(400).json({
        message: "CSV contains column headings but no alumni rows. Add at least one alumni record and try again.",
      });
    }
    const headers = headerRow.map(normalizeCsvHeader);
    const indexOf = (header) => {
      const aliases = csvHeaderAliases[header] || [header];
      return aliases
        .map(normalizeCsvHeader)
        .map((alias) => headers.indexOf(alias))
        .find((index) => index >= 0) ?? -1;
    };
    const hasHeader = (...names) =>
      names.some((name) => headers.includes(normalizeCsvHeader(name)));
    const missingHeaders = [];
    if (
      indexOf("Alumni Name") < 0 &&
      !hasHeader("First Name", "firstName", "Name") &&
      !hasHeader("Last Name", "lastName")
    ) {
      missingHeaders.push("Alumni Name (or First Name and Last Name)");
    }
    if (
      indexOf("Batch Details") < 0 &&
      !(hasHeader("Year of Joining", "Joining Year", "Study Start Year") &&
        hasHeader("Year of Completion", "Completion Year", "Study End Year"))
    ) {
      missingHeaders.push("Batch Details (or joining and completion years)");
    }
    if (
      indexOf("Department/Subject") < 0 &&
      !(hasHeader("Department") && hasHeader("Degree"))
    ) {
      missingHeaders.push("Department/Subject");
    }
    if (indexOf("Email Address") < 0) missingHeaders.push("Email Address");
    if (indexOf("Contact Number") < 0) missingHeaders.push("Contact Number");
    if (
      indexOf("Complete Postal Address") < 0 &&
      !(indexOf("Postal Address Line 1") >= 0 &&
        hasHeader("City") &&
        hasHeader("State") &&
        hasHeader("PIN Code"))
    ) {
      missingHeaders.push("Complete Postal Address (or address, city, state, and PIN)");
    }
    if (missingHeaders.length) {
      return res.status(400).json({
        message: `Could not identify the required alumni columns (${missingHeaders.join(", ")}). Detected columns: ${headerRow.map((header) => header.trim()).join(", ") || "(none)"}. Use the import template or upload a CSV with the alumni column headings in one row.`,
      });
    }

    const parsedRecords = [];
    const seenEmails = new Set();
    const seenTransactions = new Set();
    const seenReceipts = new Set();
    for (const [offset, row] of dataRows.entries()) {
      const get = (header) => {
        const value = (row[indexOf(header)] || "").trim();
        return /^'[=+\-@]/.test(value) ? value.slice(1) : value;
      };
      const getRaw = (...names) => {
        const index = names
          .map(normalizeCsvHeader)
          .map((name) => headers.indexOf(name))
          .find((columnIndex) => columnIndex >= 0);
        const value = index === undefined ? "" : (row[index] || "").trim();
        return /^'[=+\-@]/.test(value) ? value.slice(1) : value;
      };
      const joiningYear = getRaw("Year of Joining", "Joining Year", "Study Start Year");
      const completionYear = getRaw(
        "Year of Completion",
        "Completion Year",
        "Study End Year",
      );
      const sourceBatch = get("Batch Details");
      const batchDetails =
        /\d{4}\s*-\s*\d{4}/.test(sourceBatch)
          ? sourceBatch
          : joiningYear &&
              (completionYear || /^\d{4}$/.test(sourceBatch))
            ? `${joiningYear}-${completionYear || sourceBatch}`
            : sourceBatch;
      const departmentValue =
        getRaw("Department/Subject", "Subject") ||
        [getRaw("Department"), getRaw("Degree")]
          .filter(Boolean)
          .join(" / ");
      const batchEntries = batchDetails.split(/\s*&\s*/);
      const subjectEntries = departmentValue.split(/\s*&\s*/);
      const educationHistory = batchEntries.map((batch, index) => {
        const years = batch.match(/^\s*(\d{4})\s*-\s*(\d{4})\s*$/);
        const [department, ...degreeParts] = (subjectEntries[index] || "").split(" / ");
        if (!years || !department?.trim()) return null;
        return {
          department: department.trim(),
          degree: degreeParts.join(" / ").trim(),
          studyStartYear: years[1],
          studyEndYear: years[2],
        };
      });
      const firstEducation = educationHistory[0];
      const studyStartYear = firstEducation?.studyStartYear;
      const studyEndYear = firstEducation?.studyEndYear;
      const department = firstEducation?.department;
      const degree = firstEducation?.degree || "";
      const alumniName =
        get("Alumni Name") ||
        [getRaw("First Name", "firstName"), getRaw("Last Name", "lastName")]
          .filter(Boolean)
          .join(" ");
      const nameParts = alumniName.split(/\s+/);
      const postalAddress =
        get("Complete Postal Address") ||
        [
          get("Postal Address Line 1"),
          get("Postal Address Line 2"),
          get("City"),
          get("State"),
          get("PIN Code"),
          get("Country"),
        ]
          .filter(Boolean)
          .join(", ");
      const professionalLocation =
        get("Professional Location") ||
        [
          get("Professional City"),
          get("Professional State"),
          get("Professional PIN Code"),
          get("Professional Country"),
        ]
          .filter(Boolean)
          .join(", ");
      const transactionDateValue = get("Transaction Date and Time");
      const transactionDate = transactionDateValue
        ? new Date(transactionDateValue)
        : undefined;
      const email = get("Email Address").toLowerCase();
      const postalAddressDetails = {
        line1: get("Postal Address Line 1") || postalAddress,
        line2: get("Postal Address Line 2"),
        city: get("City"),
        state: get("State"),
        pincode: get("PIN Code"),
        country: get("Country"),
      };
      const professionalAddress = {
        line1: professionalLocation,
        line2: get("Professional Location Line 2"),
        city: get("Professional City"),
        state: get("Professional State"),
        pincode: get("Professional PIN Code"),
        country: get("Professional Country"),
      };
      const transactionId =
        get("Transaction ID/Reference") || getRaw("Transaction ID", "Payment Reference");
      const receiptNumber = get("Receipt Number");
      if (
        !alumniName ||
        !batchDetails ||
        !departmentValue ||
        !get("Contact Number") ||
        !postalAddress ||
        educationHistory.some((entry) => !entry) ||
        !studyStartYear ||
        !studyEndYear ||
        educationHistory.length !== subjectEntries.length ||
        !department ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        (transactionDateValue && Number.isNaN(transactionDate.getTime()))
      ) {
        throw new Error(`CSV row ${offset + 2} is missing valid required values`);
      }
      if (
        seenEmails.has(email) ||
        (transactionId && seenTransactions.has(transactionId)) ||
        (receiptNumber && seenReceipts.has(receiptNumber))
      ) {
        throw new Error(`CSV row ${offset + 2} duplicates an email, transaction, or receipt`);
      }
      seenEmails.add(email);
      if (transactionId) seenTransactions.add(transactionId);
      if (receiptNumber) seenReceipts.add(receiptNumber);
      const membershipPayment = {
        status: "paid",
        amount: Number(process.env.ALUMNI_MEMBERSHIP_FEE || 600),
        currency: "INR",
        provider: "imported-admin-attested",
        receiptEmailStatus: "imported",
      };
      if (transactionId) membershipPayment.transactionId = transactionId;
      if (receiptNumber) membershipPayment.receiptNumber = receiptNumber;
      if (transactionDate) membershipPayment.transactionDate = transactionDate;
      parsedRecords.push({
        alumniId: `PSGCAS-IMP-${crypto.randomBytes(6).toString("hex").toUpperCase()}`,
        firstName: nameParts[0],
        lastName: nameParts.slice(1).join(" "),
        email,
        password: await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12),
        phone: get("Contact Number"),
        role: "Alumni",
        department,
        degree: degree || "",
        batchYear: studyEndYear,
        studyStartYear,
        studyEndYear,
        batchDetails,
        departmentDetails: departmentValue,
        educationHistory,
        jobTitle: get("Current Designation") || getRaw("Job Title", "Designation", "Occupation"),
        currentCompany:
          get("Organization/Institution/Company") ||
          getRaw("Organization", "Institution", "Company", "Employer"),
        location: null,
        postalAddress: postalAddressDetails,
        fullAddress: postalAddress,
        membershipPayment: {
          ...membershipPayment,
        },
        officeAddress: professionalAddress,
        isApproved: false,
      });
    }

    const existingMembers = await Alumni.find({
      email: { $in: parsedRecords.map((record) => record.email) },
    })
      .select("email membershipPayment")
      .lean();
    const existingByEmail = new Map(
      existingMembers.map((member) => [member.email, member]),
    );
    const operations = parsedRecords.map((record) => {
      const { membershipPayment, ...profile } = record;
      const existing = existingByEmail.get(record.email);
      const hasVerifiedPayment =
        existing?.membershipPayment?.status === "paid" &&
        existing.membershipPayment.provider === "Easebuzz";
      const updates = Object.fromEntries(
        Object.entries(profile).filter(
          ([field]) => !["alumniId", "password", "isApproved"].includes(field),
        ),
      );
      if (existing && !hasVerifiedPayment) {
        updates.membershipPayment = membershipPayment;
      }
      const insertFields = {
        alumniId: record.alumniId,
        password: record.password,
        isApproved: false,
        ...(!existing ? { membershipPayment } : {}),
      };
      return {
        updateOne: {
          filter: { email: record.email },
          update: {
            $set: updates,
            $setOnInsert: insertFields,
          },
          upsert: true,
        },
      };
    });
    const result = await Alumni.bulkWrite(operations, { ordered: true });
    return res.json({
      message: "Paid alumni records imported successfully",
      imported: result.upsertedCount + result.modifiedCount,
      processed: parsedRecords.length,
      inserted: result.upsertedCount,
      updated: result.modifiedCount,
    });
  } catch (error) {
    console.error("Paid alumni CSV import failed:", error);
    return res.status(400).json({ message: error.message || "Failed to import CSV" });
  }
};
