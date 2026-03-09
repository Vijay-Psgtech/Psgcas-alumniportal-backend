// backend/server.js - FIXED VERSION
// ✅ Correct middleware ordering
// ✅ CORS enabled for frontend
// ✅ Routes registered properly

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();

// ═══════════════════════════════════════════════════════════════
// ✅ MIDDLEWARE (ORDER MATTERS!)
// ═══════════════════════════════════════════════════════════════

// 1. CORS - Must be first!
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:3000"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

console.log("✅ CORS enabled for http://localhost:5173");

// 2. Body Parser - Parse JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

console.log("✅ Body parser configured");

// ═══════════════════════════════════════════════════════════════
// ✅ ROUTES (After middleware!)
// ═══════════════════════════════════════════════════════════════

// Auth routes (public endpoints)
app.use("/api/auth", require("./routes/adminAuth"));

// Admin routes (protected endpoints)
app.use("/api/admin", require("./routes/admin"));
app.use("/api/admin/dash", require("./routes/adminDash"));

console.log("✅ Routes registered");

// ═══════════════════════════════════════════════════════════════
// ✅ MONGODB CONNECTION (Mongoose 7.x+ - No deprecated options!)
// ═══════════════════════════════════════════════════════════════

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/Arts-Alumni";

// ✅ FIXED: Removed deprecated useNewUrlParser and useUnifiedTopology
// These are NOT supported in Mongoose 7.x+
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB connected successfully");
    console.log(`📍 Connected to: ${MONGODB_URI}`);
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    console.error("💡 Tips:");
    console.error("   1. Is MongoDB running? (mongod)");
    console.error("   2. Is MONGODB_URI correct in .env?");
    console.error("   3. Check your .env file for the right database URL");
    process.exit(1);
  });

// ═══════════════════════════════════════════════════════════════
// ✅ ERROR HANDLING
// ═══════════════════════════════════════════════════════════════

// Catch-all 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.path}`,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("❌ Error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Server error",
    error: process.env.NODE_ENV === "development" ? err.stack : {},
  });
});

// ═══════════════════════════════════════════════════════════════
// ✅ START SERVER
// ═══════════════════════════════════════════════════════════════

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("\n" + "═".repeat(60));
  console.log("✅ SERVER STARTED SUCCESSFULLY");
  console.log("═".repeat(60));
  console.log(`📍 Server: http://localhost:${PORT}`);
  console.log(`📡 Frontend: http://localhost:5173`);
  console.log(`🗄️  Database: ${MONGODB_URI}`);
  console.log("═".repeat(60) + "\n");

  console.log("🧪 TEST COMMANDS:\n");

  console.log("1. Test login endpoint:");
  console.log(`   curl -X POST http://localhost:${PORT}/api/auth/login \\`);
  console.log('     -H "Content-Type: application/json" \\');
  console.log('     -d \'{"email":"admin@psgarts.edu","password":"Admin@123"}\'');
  console.log();

  console.log("2. Check MongoDB:");
  console.log("   mongo");
  console.log("   > db.alumni.findOne({ email: 'admin@psgarts.edu' })");
  console.log();

  console.log("3. View all alumni:");
  console.log(`   curl http://localhost:${PORT}/api/admin/alumni \\`);
  console.log("     -H 'Authorization: Bearer <YOUR_TOKEN_HERE>'");
  console.log("\n" + "═".repeat(60) + "\n");
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Rejection:", err);
  process.exit(1);
});