// backend/scripts/createAdminCORRECT.js
// ✅ CORRECTED: Properly hashes password BEFORE inserting
// ✅ Fixes the "Wrong password" error
// ✅ Admin will be able to login successfully

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const Alumni = require("../models/Alumni");

(async () => {
  try {
    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("🔧 ADMIN USER CREATION SCRIPT - CORRECTED");
    console.log("═══════════════════════════════════════════════════════════\n");

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/Arts-Alumni";
    console.log("📍 Connecting to MongoDB...");
    console.log(`    URI: ${mongoUri}\n`);

    await mongoose.connect(mongoUri);
    console.log("✅ MongoDB connected\n");

    // Admin credentials
    const adminEmail = "admin@psgarts.edu";
    const adminPassword = "Admin@123";

    console.log("📝 Admin Credentials:");
    console.log(`    Email: ${adminEmail}`);
    console.log(`    Password: ${adminPassword}\n`);

    // Delete existing admin if any (to avoid password issues)
    console.log("🧹 Checking for existing admin...");
    const existingAdmin = await Alumni.findOne({ email: adminEmail });
    
    if (existingAdmin) {
      console.log(`⚠️  Admin already exists, deleting old record...`);
      await Alumni.deleteOne({ email: adminEmail });
      console.log("✅ Old admin deleted\n");
    }

    // ✅ CORRECT: Hash password BEFORE creating
    console.log("🔐 Hashing password...");
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    console.log("✅ Password hashed:", hashedPassword);
    console.log("   (This is what will be stored in DB)\n");

    // Create NEW admin with hashed password
    console.log("➕ Creating new admin user...");
    const admin = await Alumni.create({
      email: adminEmail,
      password: hashedPassword,  // ✅ Use hashed password
      firstName: "Admin",
      lastName: "User",
      department: "Administration",
      graduationYear: 2020,
      city: "Coimbatore",
      country: "India",
      phone: "+91-0000000000",
      isAdmin: true,
      isApproved: true,
    });

    console.log("✅ Admin created successfully!\n");

    // Display admin info
    console.log("═══════════════════════════════════════════════════════════");
    console.log("📋 ADMIN USER DETAILS");
    console.log("═══════════════════════════════════════════════════════════");
    console.log(`ID:             ${admin._id}`);
    console.log(`Email:          ${admin.email}`);
    console.log(`Name:           ${admin.firstName} ${admin.lastName}`);
    console.log(`Department:     ${admin.department}`);
    console.log(`City:           ${admin.city}`);
    console.log(`Country:        ${admin.country}`);
    console.log(`isAdmin:        ${admin.isAdmin}`);
    console.log(`isApproved:     ${admin.isApproved}`);
    console.log(`Created:        ${admin.createdAt}`);
    console.log("═══════════════════════════════════════════════════════════\n");

    // Verify password works
    console.log("🧪 Testing password verification...");
    const isPasswordCorrect = await bcrypt.compare(adminPassword, admin.password);
    console.log(`Password verification result: ${isPasswordCorrect ? '✅ CORRECT' : '❌ WRONG'}\n`);

    if (isPasswordCorrect) {
      console.log("✅ Password hashing and verification working correctly!");
    } else {
      console.log("❌ ERROR: Password verification failed!");
    }

    // Instructions
    console.log("\n🚀 NEXT STEPS:\n");
    console.log("1. Start the backend server:");
    console.log("   npm start\n");

    console.log("2. Login to admin panel:");
    console.log("   URL: http://localhost:5173/admin");
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}\n`);

    console.log("3. Should redirect to /admin/dashboard ✅\n");

    console.log("═══════════════════════════════════════════════════════════\n");

    process.exit(0);
  } catch (err) {
    console.error("\n❌ ERROR:", err.message);   
    console.error("\nTroubleshooting:");
    console.error("1. Is MongoDB running? (mongod)");
    console.error("2. Is MONGODB_URI correct in .env?");
    console.error("3. Is bcryptjs installed? (npm install bcryptjs)");
    console.error("4. Check the error message above\n");
    process.exit(1);
  }
})();