import cors from "cors";
import dotenv from "dotenv";
import express from "express";
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
import reportRoutes from "./routes/reports.js";

dotenv.config();

const app = express();

const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:8080",
  "http://localhost:5173",
  "http://localhost:3000",
  "https://ubismashers.vercel.app",
  ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
  ...(process.env.VERCEL ? [/^https:\/\/.*\.vercel\.app$/] : []),
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (
        allowedOrigins.some((allowed) => {
          if (typeof allowed === "string") return allowed === origin;
          if (allowed instanceof RegExp) return allowed.test(origin);
          return false;
        })
      ) {
        callback(null, true);
      } else if (process.env.NODE_ENV === "production") {
        callback(new Error("Not allowed by CORS"));
      } else {
        callback(null, true);
      }
    },
    credentials: true,
  })
);

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
app.use("/api/equipment", equipmentRoutes);
app.use("/api/joining-fees", joiningFeeRoutes);
app.use("/api/joining-requests", joiningRequestRoutes);

app.use((err: Error & { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

export default app;
