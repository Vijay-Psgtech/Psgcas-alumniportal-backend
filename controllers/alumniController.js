// backend/controllers/alumniController.js
const Alumni = require("../models/Alumni");

// @route   GET /api/alumni
// @desc    Get all approved alumni
// @access  Public
exports.getAllAlumni = async (req, res) => {
  try {
    const { department, graduationYear, country, city, search } = req.query;

    // Build filter
    let filter = { isApproved: true };

    if (department) filter.department = department;
    if (graduationYear) filter.graduationYear = parseInt(graduationYear);
    if (country) filter.country = country;
    if (city) filter.city = city;

    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { currentCompany: { $regex: search, $options: "i" } },
      ];
    }

    const alumni = await Alumni.find(filter).select("-password");

    res.json({
      message: "Alumni retrieved successfully",
      count: alumni.length,
      alumni,
    });
  } catch (error) {
    console.error("Get All Alumni Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @route   GET /api/alumni/:id
// @desc    Get alumni by ID
// @access  Public
exports.getAlumniById = async (req, res) => {
  try {
    const alumni = await Alumni.findById(req.params.id).select("-password");

    if (!alumni || !alumni.isApproved) {
      return res.status(404).json({ message: "Alumni not found" });
    }

    res.json({
      message: "Alumni retrieved successfully",
      alumni,
    });
  } catch (error) {
    console.error("Get Alumni By ID Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @route   PUT /api/alumni/:id
// @desc    Update alumni profile
// @access  Private
exports.updateAlumniProfile = async (req, res) => {
  try {
    // ── Authorization ──────────────────────────────────────────────────────
    if (req.user.id !== req.params.id && !req.user.isAdmin) {
      return res
        .status(403)
        .json({ message: "Not authorized to update this profile" });
    }

    const allowedFields = [
      "firstName",
      "lastName",
      "phone",
      "gender",
      "occupation",

      "department",
      "graduationYear",
      "rollNumber",
      "degree",
      "programmeType",
      "studyStartYear",
      "studyEndYear",
      "batchYear",

      "currentCompany",
      "jobTitle",
      "industry",
      "officeContact",

      "country",
      "city",
      "fullAddress",
    ];

    const updateData = {};

    allowedFields.forEach((key) => {
      if (req.body[key] !== undefined) {
        updateData[key] = req.body[key];
      }
    });

    // ── 2. Nested: social links ────────────────────────────────────────────
    // Frontend sends either a JSON string or dot-notation keys like "social.linkedin"
    const socialFields = [
      "linkedin",
      "twitter",
      "instagram",
      "facebook",
      "website",
    ];
    const socialUpdate = {};

    if (req.body.social) {
      // Sent as a serialized JSON string e.g. FormData.append("social", JSON.stringify({...}))
      try {
        const parsed =
          typeof req.body.social === "string"
            ? JSON.parse(req.body.social)
            : req.body.social;
        socialFields.forEach((key) => {
          if (parsed[key] !== undefined) socialUpdate[key] = parsed[key];
        });
      } catch (_) {
        // malformed JSON — skip silently
      }
    } else {
      // Sent as dot-notation keys e.g. "social.linkedin"
      socialFields.forEach((key) => {
        const dotKey = `social.${key}`;
        if (req.body[dotKey] !== undefined)
          socialUpdate[key] = req.body[dotKey];
      });
    }

    if (Object.keys(socialUpdate).length > 0) {
      // Merge into existing social sub-document (don't wipe keys not sent)
      socialFields.forEach((key) => {
        if (socialUpdate[key] !== undefined) {
          updateData[`social.${key}`] = socialUpdate[key];
        }
      });
    }

    // ── 3. Nested: office address ──────────────────────────────────────────
    const officeAddressFields = [
      "line1",
      "line2",
      "city",
      "state",
      "pincode",
      "country",
    ];
    const officeUpdate = {};

    if (req.body.officeAddress) {
      try {
        const parsed =
          typeof req.body.officeAddress === "string"
            ? JSON.parse(req.body.officeAddress)
            : req.body.officeAddress;
        officeAddressFields.forEach((key) => {
          if (parsed[key] !== undefined) officeUpdate[key] = parsed[key];
        });
      } catch (_) {
        // malformed JSON — skip silently
      }
    } else {
      officeAddressFields.forEach((key) => {
        const dotKey = `officeAddress.${key}`;
        if (req.body[dotKey] !== undefined)
          officeUpdate[key] = req.body[dotKey];
      });
    }

    if (Object.keys(officeUpdate).length > 0) {
      officeAddressFields.forEach((key) => {
        if (officeUpdate[key] !== undefined) {
          updateData[`officeAddress.${key}`] = officeUpdate[key];
        }
      });
    }

    // ── 4. Geo coordinates → location GeoJSON ─────────────────────────────
    if (req.body.coordinates) {
      let coords = req.body.coordinates;
      // multer / express may give an array or a comma-separated string
      if (typeof coords === "string") {
        coords = coords.split(",").map(Number);
      } else if (Array.isArray(coords)) {
        coords = coords.map(Number);
      }
      if (coords.length === 2 && coords.every((n) => !isNaN(n))) {
        updateData.location = { type: "Point", coordinates: coords };
      }
    }

    // ── 5. Profile photo (single, field name: "profileImage") ─────────────
    if (req.file) {
      updateData.profileImage = req.file.path.replace(/\\/g, "/");
    }

    // ── 6. Document files (multiple, each under its own field name) ────────
    // Expects multer fields: studentPhoto, currentPhoto, idCard,
    //                        businessCard, entrepreneurPoster
    const documentFields = [
      "studentPhoto",
      "currentPhoto",
      "idCard",
      "businessCard",
      "entrepreneurPoster",
    ];

    if (req.files) {
      documentFields.forEach((field) => {
        const uploaded = req.files[field];
        if (uploaded && uploaded.length > 0) {
          updateData[`files.${field}`] = uploaded[0].path.replace(/\\/g, "/");
        }
      });
    }

    // ── 7. Persist ─────────────────────────────────────────────────────────
    const alumni = await Alumni.findByIdAndUpdate(
      req.params.id,
      { $set: updateData }, // $set so dot-notation merges nested fields safely
      { new: true, runValidators: true },
    ).select("-password");

    if (!alumni) {
      return res.status(404).json({ message: "Alumni not found" });
    }

    res.json({ message: "Profile updated successfully", alumni });
  } catch (error) {
    console.error("Update Alumni Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @route   GET /api/alumni/stats/get-stats
// @desc    Get alumni statistics
// @access  Public
exports.getStats = async (req, res) => {
  try {
    const totalAlumni = await Alumni.countDocuments({ isApproved: true });
    const totalCountries = await Alumni.distinct("country", {
      isApproved: true,
    });
    const totalCities = await Alumni.distinct("city", { isApproved: true });
    const pendingApprovals = await Alumni.countDocuments({ isApproved: false });

    res.json({
      message: "Statistics retrieved successfully",
      stats: {
        totalAlumni,
        countriesRepresented: totalCountries.length,
        citiesRepresented: totalCities.length,
        pendingApprovals,
      },
    });
  } catch (error) {
    console.error("Get Stats Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @route   GET /api/alumni/map/data
// @desc    Get alumni data for map visualization
// @access  Public
exports.getMapData = async (req, res) => {
  try {
    const alumni = await Alumni.find({
      isApproved: true,
      country: { $exists: true },
      city: { $exists: true },
    })
      .select("-password")
      .lean();

    // Group by country
    const groupedByCountry = {};
    alumni.forEach((a) => {
      if (!groupedByCountry[a.country]) {
        groupedByCountry[a.country] = [];
      }
      groupedByCountry[a.country].push(a);
    });

    // Group by city within each country
    Object.keys(groupedByCountry).forEach((country) => {
      const cityGroups = {};
      groupedByCountry[country].forEach((a) => {
        if (!cityGroups[a.city]) {
          cityGroups[a.city] = [];
        }
        cityGroups[a.city].push(a);
      });
      groupedByCountry[country] = cityGroups;
    });

    res.json({
      message: "Map data retrieved successfully",
      data: {
        alumni,
        groupedByCountry,
        stats: {
          totalAlumni: alumni.length,
          countriesRepresented: Object.keys(groupedByCountry).length,
          citiesRepresented: Object.keys(groupedByCountry).reduce(
            (acc, country) =>
              acc + Object.keys(groupedByCountry[country]).length,
            0,
          ),
        },
      },
    });
  } catch (error) {
    console.error("Get Map Data Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
