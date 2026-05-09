require("dotenv").config();
const express = require("express");
const cors = require("cors");
const prisma = require("./src/lib/prisma"); // dùng 1 instance chung

const app = express();
const port = process.env.PORT || 3000;

// ================= MIDDLEWARE =================
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================= ROUTES =================

// Auth
const authRoutes = require("./src/routes/auth.routes");
app.use("/api/auth", authRoutes);

// Chat
const chatRoutes = require("./src/routes/chat.routes");
app.use("/api/chat", chatRoutes);

// Admin
const adminRoutes = require("./src/routes/admin.routes");
app.use("/api/admin", adminRoutes);

// Trip plans (saved)
const tripPlanRoutes = require("./src/routes/tripPlan.routes");
app.use("/api/trip-plans", tripPlanRoutes);

// Billing
const billingRoutes = require("./src/routes/billing.routes");
app.use("/api/billing", billingRoutes);

// Health check (for frontend)
app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "api" });
});

// ================= HEALTH CHECK =================
app.get("/", (req, res) => {
  res.json({ message: "API running 🚀" });
});

// ================= 404 HANDLER =================
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// ================= GLOBAL ERROR HANDLER =================
app.use((err, req, res, next) => {
  console.error(err);

  const msg = String(err?.message || "");
  const isSchemaOutOfDate =
    msg.includes("Unknown argument `clerkUserId`") ||
    msg.includes("Unknown argument `bannedAt`") ||
    msg.includes("Unknown argument `banReason`") ||
    msg.includes("P2022") ||
    msg.toLowerCase().includes("invalid column name") ||
    msg.toLowerCase().includes("clerkuserid");

  if (isSchemaOutOfDate) {
    return res.status(500).json({
      message:
        "Server schema is out of date (missing clerkUserId/ban fields). Run Prisma migrate + generate, then restart the API.",
      hint: "cd api && npx prisma migrate dev --name add_clerk_fields && npx prisma generate",
    });
  }

  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
  });
});

// ================= START SERVER =================
const server = app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

// ================= GRACEFUL SHUTDOWN =================
process.on("SIGINT", async () => {
  console.log("Shutting down...");
  await prisma.$disconnect();
  server.close(() => {
    process.exit(0);
  });
});
