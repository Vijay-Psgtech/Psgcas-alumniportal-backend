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
  }),
);

app.use(express.json());
app.use(cookieParser());

// ── Health check ─────────────────────────────────────────────────
app.get("/api/health", (_req, res) =>
  res.json({ message: "Server is running", status: "OK" }),
);

// ── Routes ───────────────────────────────────────────────────────
// Auth: register, login, forgot-password, verify-otp, reset-password, profile
app.use("/api/auth", require("./routes/auth"));

// Alumni directory (public + protected profile update)
app.use("/api/alumni", require("./routes/alumni"));

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
