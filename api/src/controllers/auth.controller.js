const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");
const { generateAccessToken, generateRefreshToken } = require("../utils/jwt");
const crypto = require("crypto");
const { verifyClerkToken, fetchClerkUser } = require("../utils/clerk");

function isPrismaSchemaOutOfDate(err) {
  const msg = String(err?.message || "");
  return (
    msg.includes("Unknown argument `clerkUserId`") ||
    msg.includes("Unknown argument `bannedAt`") ||
    msg.includes("Unknown argument `banReason`") ||
    msg.includes("P2022") ||
    msg.toLowerCase().includes("invalid column name") ||
    msg.toLowerCase().includes("clerkuserid")
  );
}

// ================= REGISTER =================
exports.register = async (req, res) => {
  const { username, name, email, password } = req.body;

  const finalUsername = (username || name || "").toString().trim();

  if (!finalUsername || !email || !password) {
    return res.status(400).json({ message: "Missing fields" });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  const exist = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (exist) return res.status(400).json({ message: "Email already exists" });

  const hashed = await bcrypt.hash(password, 10);

  // Bootstrap: make the very first registered account a SUPER_ADMIN.
  const userCount = await prisma.user.count();
  const role = userCount === 0 ? "SUPER_ADMIN" : "USER";

  const user = await prisma.user.create({
    data: { name: finalUsername, email: normalizedEmail, password: hashed, role },
  });

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  res.status(201).json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      username: user.name,
      email: user.email,
      role: user.role,
    },
  });
};

// ================= LOGIN =================
exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Missing fields" });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (!user) return res.status(400).json({ message: "User not found" });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(400).json({ message: "Password is incorrect" });

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Xóa refresh token cũ (optional)
  await prisma.refreshToken.deleteMany({
    where: { userId: user.id },
  });

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  res.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      username: user.name,
      email: user.email,
      role: user.role,
    },
  });
};

// ================= REFRESH TOKEN =================
exports.refreshToken = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ message: "Refresh token required" });
  }

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch (err) {
    return res.status(403).json({ message: "Invalid refresh token" });
  }

  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
  });

  // Reuse detection: token is valid (signature ok) but not found in DB.
  // This usually means the refresh token was rotated and someone is trying to reuse an old token.
  if (!storedToken) {
    if (decoded && decoded.id) {
      await prisma.refreshToken.deleteMany({ where: { userId: decoded.id } });
    }
    return res.status(403).json({ message: "Invalid refresh token" });
  }

  if (storedToken.expiresAt < new Date()) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    return res.status(403).json({ message: "Refresh token expired" });
  }

  const user = await prisma.user.findUnique({
    where: { id: storedToken.userId },
  });

  if (!user) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    return res.status(403).json({ message: "Invalid refresh token" });
  }

  if (user.bannedAt) {
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    return res.status(403).json({ message: "Account is banned" });
  }

  const newAccessToken = generateAccessToken(user);

  // Rotate refresh token: invalidate the old one and issue a new one.
  // Multiple parallel refresh requests can happen (multi-tab, many API calls after idle).
  // Ensure we never fail due to refresh token uniqueness collisions.
  let newRefreshToken = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    newRefreshToken = generateRefreshToken(user);
    try {
      await prisma.$transaction([
        // Use deleteMany to avoid throwing if the token was already deleted (race/parallel refresh).
        prisma.refreshToken.deleteMany({ where: { token: refreshToken } }),
        prisma.refreshToken.create({
          data: {
            token: newRefreshToken,
            userId: user.id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        }),
      ]);
      break;
    } catch (err) {
      if (err && err.code === "P2002" && attempt < 2) continue;
      throw err;
    }
  }

  res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
};

// ================= LOGOUT =================
exports.logout = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ message: "Refresh token required" });
  }

  await prisma.refreshToken.deleteMany({
    where: { token: refreshToken },
  });

  res.json({ message: "Logged out successfully" });
};

// ================= FORGOT PASSWORD =================
const { sendResetPasswordEmail } = require("../utils/mail");

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const resetToken = crypto.randomBytes(32).toString("hex");

  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  await prisma.user.update({
    where: { email },
    data: {
      resetPasswordToken: hashedToken,
      resetPasswordExpires: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

  await sendResetPasswordEmail(email, resetLink);

  res.json({ message: "Password reset email sent" });
};

// ================= RESET PASSWORD =================
exports.resetPassword = async (req, res) => {
  const { token, password } = req.body;

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await prisma.user.findFirst({
    where: {
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { gt: new Date() },
    },
  });

  if (!user) {
    return res.status(400).json({ message: "Invalid or expired token" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      resetPasswordToken: null,
      resetPasswordExpires: null,
    },
  });

  res.json({ message: "Password reset successful" });
};

// ================= CLERK EXCHANGE (Clerk session token -> Backend JWT) =================
exports.clerkExchange = async (req, res) => {
  if (!process.env.CLERK_JWKS_URL) {
    return res.status(500).json({ message: "Server not configured: CLERK_JWKS_URL is missing" });
  }
  if (!process.env.CLERK_SECRET_KEY) {
    return res.status(500).json({ message: "Server not configured: CLERK_SECRET_KEY is missing" });
  }

  const bearer = req.header("Authorization") || "";
  const token = bearer.startsWith("Bearer ") ? bearer.slice("Bearer ".length) : "";
  if (!token) return res.status(401).json({ message: "No token provided" });

  let payload;
  try {
    payload = await verifyClerkToken(token);
  } catch (err) {
    const detail = String(err?.message || "verify failed").slice(0, 160);
    return res.status(401).json({ message: "Invalid Clerk token", detail });
  }

  const clerkUserId = payload?.sub;
  if (!clerkUserId) return res.status(400).json({ message: "Missing Clerk user id" });

  const clerkUser = await fetchClerkUser(clerkUserId);

  const primaryEmailId = clerkUser?.primary_email_address_id;
  const emailObj = Array.isArray(clerkUser?.email_addresses)
    ? clerkUser.email_addresses.find((e) => e.id === primaryEmailId) || clerkUser.email_addresses[0]
    : null;
  const email = (emailObj?.email_address || "").toString().trim().toLowerCase();

  if (!email) return res.status(400).json({ message: "Clerk user has no email" });

  const usernameFromClerk = (clerkUser?.username || "").toString().trim();
  const nameFromClerk = `${clerkUser?.first_name || ""} ${clerkUser?.last_name || ""}`.trim();
  const nameFromEmail = email.includes("@") ? email.split("@")[0] : email;
  const name = usernameFromClerk || nameFromClerk || nameFromEmail || "Clerk User";

  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    const userCount = await prisma.user.count();
    const role = userCount === 0 ? "SUPER_ADMIN" : "USER";

    const randomPassword = crypto.randomBytes(32).toString("hex");
    const hashed = await bcrypt.hash(randomPassword, 10);
    try {
      user = await prisma.user.create({
        data: {
          name,
          email,
          password: hashed,
          role,
          clerkUserId,
        },
      });
    } catch (err) {
      if (isPrismaSchemaOutOfDate(err)) {
        return res.status(500).json({
          message:
            "Server schema is out of date (missing clerkUserId/ban fields). Run Prisma migrate + generate, then restart the API.",
          hint: "cd api && npx prisma migrate dev --name add_clerk_fields && npx prisma generate",
        });
      }
      throw err;
    }
  } else if (!user.clerkUserId) {
    try {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { clerkUserId },
      });
    } catch (err) {
      if (isPrismaSchemaOutOfDate(err)) {
        return res.status(500).json({
          message:
            "Server schema is out of date (missing clerkUserId/ban fields). Run Prisma migrate + generate, then restart the API.",
          hint: "cd api && npx prisma migrate dev --name add_clerk_fields && npx prisma generate",
        });
      }
      throw err;
    }
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  res.json({
    accessToken,
    refreshToken,
    user: { id: user.id, username: user.name, email: user.email, role: user.role },
  });
};
