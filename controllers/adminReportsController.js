const Alumni = require("../models/Alumni");
const Event = require("../models/Events");

exports.getAlumniByYear = async (req, res) => {
  try {
    const totalCount = await Alumni.countDocuments();
    const countByYear = await Alumni.aggregate([
      {
        $project: {
          year: "$graduationYear",
        },
      },
      {
        $group: {
          _id: "$year",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          year: "$_id",
          count: 1,
        },
      },
      { $sort: { year: 1 } },
    ]);

    const allAlumni = await Alumni.find().sort({ createdAt: -1 }).limit(10);

    res.status(200).json({
      success: true,
      data: {
        totalCount,
        countByYear,
        allAlumni,
      },
    });
  } catch (error) {
    console.error("Error fetching alumni count by year:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
