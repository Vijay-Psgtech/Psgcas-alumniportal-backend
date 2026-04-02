const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs").promises;
const connectDB = require("./config/db");
const chaptersRoutes = require("./routes/chapters");
const fileUpload = require("express-fileupload");

dotenv.config();

const app = express();
connectDB();

// ── CORS ─────────────────────────────────────────────────────────
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://localhost:5000",
  "http://localhost:5100",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ── MIDDLEWARE ───────────────────────────────────────────────────
app.use(express.json());
app.use(cookieParser());
app.use(fileUpload());

// ── STATIC FILES ─────────────────────────────────────────────────
app.use("/uploads", express.static("uploads"));

// ── CREATE UPLOAD DIRECTORIES ────────────────────────────────────
const createUploadsDir = async () => {
  try {
    await fs.mkdir(path.join(__dirname, "uploads/chapters"), { recursive: true });
    await fs.mkdir(path.join(__dirname, "uploads/events"), { recursive: true });
    await fs.mkdir(path.join(__dirname, "uploads/alumni"), { recursive: true });
    console.log("✅ Upload directories created");
  } catch (error) {
    console.error("❌ Error creating upload dirs:", error);
  }
};
createUploadsDir();

// ── HEALTH CHECK ─────────────────────────────────────────────────
app.get("/api/health", (_req, res) =>
  res.json({ message: "Server is running", status: "OK" })
);

// ── ROUTES ───────────────────────────────────────────────────────
app.use("/api/auth", require("./routes/auth"));

// ✅ chapters BEFORE alumni (prevents /chapters being caught by /:id)
app.use("/api/alumni/chapters", chaptersRoutes);
app.use("/api/alumni", require("./routes/alumni"));

app.use("/api/admin", require("./routes/admin"));
app.use("/api/admin/dashboard", require("./routes/adminDash"));
app.use("/api/events", require("./routes/events"));
app.use("/api/albums", require("./routes/albums"));
app.use("/api/donations", require("./routes/donation"));
app.use("/api/reports", require("./routes/adminReports"));

// ── ERROR HANDLER ────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error("❌ Unhandled error:", err);
  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
  });
});

// ── START SERVER ─────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 PSG Alumni Backend running on port ${PORT}`);
  console.log(`📍 API Base: http://localhost:${PORT}/api`);
  console.log(`💾 Upload Directory: ${path.join(__dirname, "uploads")}`);
});

module.exports = app;