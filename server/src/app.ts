import cors, { type CorsOptionsDelegate } from "cors";
import dotenv from "dotenv";
import express, { type ErrorRequestHandler } from "express";

import attendanceRoutes from "./routes/attendance.js";
import authRoutes from "./routes/auth.js";
import bookingRoutes from "./routes/bookings.js";
import equipmentRoutes from "./routes/equipment.js";
import expenseRoutes from "./routes/expenses.js";
import joiningFeeRoutes from "./routes/joiningFees.js";
import joiningRequestRoutes from "./routes/joiningRequests.js";
import memberRoutes from "./routes/members.js";
import notificationRoutes from "./routes/notifications.js";
import paymentRoutes from "./routes/payments.js";
import publicRoutes from "./routes/public.js";
import publicTournamentRoutes from "./routes/publicTournaments.js";
import reportRoutes from "./routes/reports.js";
import tournamentRoutes from "./routes/tournaments.js";

dotenv.config();

const app = express();

const normalizeOrigin = (origin: string) => origin.trim().replace(/\/$/, "");

const allowedOrigins = new Set(
  [
    process.env.FRONTEND_URL,
    "http://localhost:8080",
    "http://localhost:5173",
    "http://localhost:3000",
    "https://ubismashers.vercel.app",
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  ]
    .filter((origin): origin is string => Boolean(origin))
    .map(normalizeOrigin)
);

const allowedOriginPatterns = [/^https:\/\/.*\.vercel\.app$/];

const isOriginAllowed = (origin: string) => {
  const normalizedOrigin = normalizeOrigin(origin);
  return (
    allowedOrigins.has(normalizedOrigin) ||
    allowedOriginPatterns.some((pattern) => pattern.test(normalizedOrigin))
  );
};

const corsOptionsDelegate: CorsOptionsDelegate = (req, callback) => {
  const originHeader = typeof req.headers.origin === "string" ? req.headers.origin : undefined;
  const requestedHeaders =
    typeof req.headers["access-control-request-headers"] === "string"
      ? req.headers["access-control-request-headers"]
      : undefined;

  if (!originHeader) {
    return callback(null, { origin: true });
  }

  if (!isOriginAllowed(originHeader)) {
    return callback(new Error("Not allowed by CORS"));
  }

  return callback(null, {
    origin: originHeader,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    allowedHeaders: requestedHeaders || [
      "Content-Type",
      "Authorization",
      "Accept",
      "Origin",
      "X-Requested-With",
    ],
    optionsSuccessStatus: 204,
    maxAge: 86400,
  });
};

app.use(cors(corsOptionsDelegate));
app.options("*", cors(corsOptionsDelegate));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", message: "Court Cost Connect API is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/public/tournaments", publicTournamentRoutes);
app.use("/api/equipment", equipmentRoutes);
app.use("/api/joining-fees", joiningFeeRoutes);
app.use("/api/joining-requests", joiningRequestRoutes);
app.use("/api/tournaments", tournamentRoutes);

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error("Error:", err.message);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
};

app.use(errorHandler);

export default app;
