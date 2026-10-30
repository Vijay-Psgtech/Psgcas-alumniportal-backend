const Alumni = require("../models/Alumni");
const { transporter } = require("../config/mailer");

// GET /api/admin/pending
exports.getPendingAlumni = async (req, res) => {
  try {
    const alumni = await Alumni.find({ isApproved: false }).select("-password");
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
    const alumni = await Alumni.findByIdAndUpdate(
      req.params.id,
      { isApproved: true },
      { new: true },
    ).select("-password");

    if (!alumni) return res.status(404).json({ message: "Alumni not found" });

    if (alumni.email) {
      try {
        await transporter.sendMail({
          from: `"PSG CAS Alumni Association" <${process.env.EMAIL_USER}>`,
          to: alumni.email,
          subject: "Your alumni registration has been approved",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #f9fafb;">
              <div style="background: linear-gradient(135deg, #0f766e, #2563eb); color: #ffffff; padding: 24px; border-radius: 10px 10px 0 0; text-align: center;">
                <h2 style="margin: 0; font-size: 24px;">Registration Approved</h2>
              </div>
              <div style="padding: 24px; background-color: #ffffff; border-radius: 0 0 10px 10px;">
                <p style="margin: 0 0 12px; font-size: 16px; color: #111827;">Dear ${alumni.firstName || "Alumni"},</p>
                <p style="margin: 0 0 12px; font-size: 15px; color: #374151; line-height: 1.6;">
                  Your alumni registration with the PSG CAS Alumni Association has been approved successfully.
                </p>
                <p style="margin: 0 0 16px; font-size: 15px; color: #374151; line-height: 1.6;">
                  You can now log in to the portal and access your alumni account.
                </p>
                <p style="margin: 0 0 20px;">
                  <a href="https://alumni.psgcas.ac.in/alumni/login" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 6px; font-weight: bold;">
                    Go to Login Portal
                  </a>
                </p>
                <p style="margin: 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
                  Warm regards,<br />
                  <strong>PSG CAS Alumni Association</strong>
                </p>
              </div>
            </div>
          `,
        });
      } catch (mailError) {
        console.error("Approval email send failed:", mailError);
      }
    }

    res.json({ message: "Alumni approved successfully", alumni });
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