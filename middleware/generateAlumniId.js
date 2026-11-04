const Counter = require("../models/Counter");

exports.createAlumniId = async () => {
  const counter = await Counter.findOneAndUpdate(
    { name: "alumniId" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );

  return `PSGCAS-ALU-${String(counter.seq).padStart(6, "0")}`;
};

exports.generateAlumniId = async (req, res, next) => {
  try {
    req.alumniId = await exports.createAlumniId();
    next();
  } catch (error) {
    next(error);
  }
};
