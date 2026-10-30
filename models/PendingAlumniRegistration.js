const mongoose = require("mongoose");

const pendingAlumniRegistrationSchema = new mongoose.Schema(
  {
    alumniId: { type: String, required: true, unique: true },
    email: { type: String, required: true, lowercase: true, unique: true },
    transactionId: { type: String, required: true, unique: true },
    encryptedProfile: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

pendingAlumniRegistrationSchema.index({ expiresAt: 1 });

module.exports = mongoose.model(
  "PendingAlumniRegistration",
  pendingAlumniRegistrationSchema,
);
