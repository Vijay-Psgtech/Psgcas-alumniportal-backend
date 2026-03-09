// backend/scripts/createAdmin.js
// ✅ Creates admin user in MongoDB with hashed password
// ✅ Sets isAdmin and isApproved to true
// ✅ Run: node scripts/createAdmin.js

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const Alumni = require("../models/Alumni");

(async () => {
  try {
    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("🔧 ADMIN USER CREATION SCRIPT");
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

    // Check if admin already exists
    console.log("🔍 Checking if admin already exists...");
    let admin = await Alumni.findOne({ email: adminEmail });

    if (admin) {
      console.log("⚠️  Admin user already exists!");
      console.log(`    Email: ${admin.email}`);
      console.log(`    isAdmin: ${admin.isAdmin}`);
      console.log(`    isApproved: ${admin.isApproved}\n`);

      // Update existing admin
      console.log("🔄 Updating admin privileges...\n");
      
      // Hash new password
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      
      admin = await Alumni.findByIdAndUpdate(
        admin._id,
        {
          password: hashedPassword,
          isAdmin: true,
          isApproved: true,
          firstName: admin.firstName || "Admin",
          lastName: admin.lastName || "User",
        },
        { new: true }
      );

      console.log("✅ Admin updated successfully!\n");
    } else {
      console.log("ℹ️  Admin doesn't exist, creating new...\n");

      // Hash password
      console.log("🔐 Hashing password...");
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      console.log("✅ Password hashed\n");

      // Create admin
      console.log("➕ Creating admin user...");
      admin = await Alumni.create({
        email: adminEmail,
        password: hashedPassword,
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
    }

    // Display admin info
    console.log("═══════════════════════════════════════════════════════════");
    console.log("📋 ADMIN USER DETAILS");
    console.log("═══════════════════════════════════════════════════════════");
    console.log(`ID:         ${admin._id}`);
    console.log(`Email:      ${admin.email}`);
    console.log(`Name:       ${admin.firstName} ${admin.lastName}`);
    console.log(`Department: ${admin.department}`);
    console.log(`City:       ${admin.city}`);
    console.log(`Country:    ${admin.country}`);
    console.log(`isAdmin:    ${admin.isAdmin}`);
    console.log(`isApproved: ${admin.isApproved}`);
    console.log(`Created:    ${admin.createdAt}`);
    console.log("═══════════════════════════════════════════════════════════\n");

    // Instructions
    console.log("🚀 NEXT STEPS:\n");
    console.log("1. Start the backend server:");
    console.log("   npm start\n");

    console.log("2. Login to admin panel:");
    console.log("   URL: http://localhost:5173/admin");
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}\n`);

    console.log("3. Or test with curl:");
    console.log(`   curl -X POST http://localhost:5000/api/auth/login \\`);
    console.log(`     -H "Content-Type: application/json" \\`);
    console.log(`     -d '{"email":"${adminEmail}","password":"${adminPassword}"}'\n`);

    console.log("═══════════════════════════════════════════════════════════\n");

    process.exit(0);
  } catch (err) {
    console.error("\n❌ ERROR:", err.message);
    console.error("\nTroubleshooting:");
    console.error("1. Is MongoDB running? (mongod)");
    console.error("2. Is MONGODB_URI correct in .env?");
    console.error("3. Are Alumni model dependencies installed?");
    console.error("4. Check bcryptjs is installed: npm install bcryptjs\n");
    process.exit(1);
  }
})();