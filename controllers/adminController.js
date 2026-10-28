const Alumni = require("../models/Alumni");

// GET /api/admin/pending
exports.getPendingAlumni = async (req, res) => {
  try {
    const alumni = await Alumni.find({
      isApproved: false,
      "membershipPayment.status": "paid",
    }).select("-password");
    res.json({
      message: "Pending alumni retrieved successfully",
      count: alumni.length,
      alumni,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// PUT /api/admin/approve/:id
exports.approveAlumni = async (req, res) => {
  try {
    const alumni = await Alumni.findById(req.params.id);
    if (!alumni) return res.status(404).json({ message: "Alumni not found" });
    if (alumni.membershipPayment?.status !== "paid") {
      return res.status(409).json({
        message: "Membership cannot be approved before payment is verified",
      });
    }

    alumni.isApproved = true;
    await alumni.save();
    res.json({
      message: "Alumni approved successfully",
      alumni: await Alumni.findById(alumni._id).select("-password"),
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// PUT /api/admin/reject/:id   ← ✅ FIX: route in admin.js was /reject/:id
exports.rejectAlumni = async (req, res) => {
  try {
    const alumni = await Alumni.findByIdAndDelete(req.params.id);
    if (!alumni) return res.status(404).json({ message: "Alumni not found" });

    res.json({ message: "Alumni registration rejected and deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};