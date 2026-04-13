// backend/scripts/seedAdmin.js
// Run: node backend/scripts/seedAdmin.js

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

// Import Alumni model
const Alumni = require("../models/Alumni");

const ADMIN_CREDENTIALS = {
  firstName: "Admin",
  lastName: "User",
  email: "admin@psgcas.com",
  password: "admin123", // ⚠️ CHANGE THIS IN PRODUCTION
  isAdmin: true,
  isApproved: true,
};

const seedAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Check if admin already exists
    const existingAdmin = await Alumni.findOne({ email: ADMIN_CREDENTIALS.email });
    if (existingAdmin) {
      console.log("⚠️  Admin user already exists with this email!");
      console.log(`   Email: ${existingAdmin.email}`);
      console.log(`   Name: ${existingAdmin.firstName} ${existingAdmin.lastName}`);
      
      // Ask if user wants to reset password
      console.log("\n🔄 To reset the admin password, delete this user first:");
      console.log(`   db.alumni.deleteOne({ email: "${ADMIN_CREDENTIALS.email}" })`);
      
      await mongoose.connection.close();
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(ADMIN_CREDENTIALS.password, 10);

    // Create admin user
    const admin = new Alumni({
      firstName: ADMIN_CREDENTIALS.firstName,
      lastName: ADMIN_CREDENTIALS.lastName,
      email: ADMIN_CREDENTIALS.email.toLowerCase(),
      password: hashedPassword,
      isAdmin: true,
      isApproved: true,
      phone: "+91-XXXXXXXXXX",
      gender: "Not Specified",
      occupaton: "Admin",
    });

    await admin.save();

    console.log("\n✅ Admin user created successfully!");
    console.log("═══════════════════════════════════");
    console.log(`📧 Email:    ${ADMIN_CREDENTIALS.email}`);
    console.log(`🔐 Password: ${ADMIN_CREDENTIALS.password}`);
    console.log("═══════════════════════════════════");
    console.log("\n⚠️  IMPORTANT:");
    console.log("   1. Change the password after first login!");
    console.log("   2. Never commit actual passwords to git");
    console.log("   3. Use environment variables for credentials in production\n");

    await mongoose.connection.close();
    console.log("✅ Database connection closed");
  } catch (error) {
    console.error("❌ Seed Error:", error.message);
    process.exit(1);
  }
};

seedAdmin();