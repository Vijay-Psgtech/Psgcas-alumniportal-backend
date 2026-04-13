const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const connectDB = require("./config/db");

dotenv.config();

const app = express();
connectDB();

// ── CORS ─────────────────────────────────────────────────────────
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5000",
  "https://alumnitestpsgcas.psginstitutions.in",
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
  }),
);

// For local development, allow all origins. In production, this should be restricted to the frontend domain(s).
// app.use(
//   cors({
//     origin: true,
//     credentials: true,
//     methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
//     allowedHeaders: ["Content-Type", "Authorization"],
//   }),
// );

app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static("uploads"));

// ── Health check ─────────────────────────────────────────────────
app.get("/api/health", (_req, res) =>
  res.json({ message: "Server is running", status: "OK" }),
);

// ── Routes ───────────────────────────────────────────────────────
// Auth: register, login, forgot-password, verify-otp, reset-password, profile
app.use("/api/auth", require("./routes/auth"));

// ✅ NEW: DEPARTMENTS API (Dynamic departments management)
app.use("/api/departments", require("./routes/departments"));

// Chapters must be mounted before /api/alumni, otherwise /api/alumni/:id catches /api/alumni/chapters
app.use("/api/alumni/chapters", require("./routes/chapters"));

// Alumni directory (public + protected profile update)
app.use("/api/alumni", require("./routes/alumni"));

// Admin simple routes (approve/reject/stats) — uses Alumni model + isAdmin flag
app.use("/api/admin", require("./routes/admin"));

// Admin dashboard (full alumni mgmt + donations + stats)
app.use("/api/admin/dashboard", require("./routes/adminDash"));

// ── NEW: EVENTS API (Create, Read, Update, Delete) ───────────────
app.use("/api/events", require("./routes/events"));

// ── NEW: ALBUMS API (Create, Read, Update, Delete) ───────────────
app.use("/api/albums", require("./routes/albums"));

// ── NEW: NEWSLETTERS API (Create, Read, Update, Delete) ───────────────
app.use("/api/newsletters", require("./routes/newsletters"));

// Donations (public create + protected mine + admin all)
app.use("/api/donations", require("./routes/donation"));

// Chapters
app.use("/api/alumni/chapters", require("./routes/chapters"));

// Notifications (alumni submit + admin approve/reject)
app.use("/api/notifications", require("./routes/notifications"));

// Reports routes for admin
app.use("/api/reports", require("./routes/adminReports"));

// ── Error handler ────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 PSG Alumni Backend running on port ${PORT}`);
});
