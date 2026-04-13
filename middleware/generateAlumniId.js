const Alumni = require("../models/Alumni");

exports.generateAlumniId = async (req, res, next) => {
  try {
    const count = await Alumni.countDocuments();

    const alumniId = `PSGCAS-ALU-${String(count + 1).padStart(6, "0")}`;

    req.alumniId = alumniId;

    next();
  } catch (error) {
    next(error);
  }
};
