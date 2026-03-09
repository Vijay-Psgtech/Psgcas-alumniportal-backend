// backend/config/db.js
// ✅ DATABASE CONNECTION FILE - COPY THIS TO backend/config/db.js
// This file was MISSING and causing your registration/login to fail!

const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    console.log("\n🔍 Attempting to connect to MongoDB...");
    console.log("   URI:", process.env.MONGODB_URI);

    const conn = await mongoose.connect(process.env.MONGODB_URI);

    console.log(`✅ MongoDB Connected Successfully!`);
    console.log(`   Host: ${conn.connection.host}`);
    console.log(`   Database: ${conn.connection.name}`);
    console.log(`   Connection State: ${conn.connection.readyState === 1 ? "Connected" : "Disconnected"}\n`);
    
    return conn;
  } catch (error) {
    console.error(`\n❌ MongoDB Connection Error!`);
    console.error(`   Message: ${error.message}`);
    console.error(`   Code: ${error.code}`);
    console.error(`   Make sure:`);
    console.error(`   1. MongoDB is running`);
    console.error(`   2. MONGODB_URI is correct in .env`);
    console.error(`   3. Connection string format is valid\n`);
    
    process.exit(1);
  }
};

module.exports = connectDB;