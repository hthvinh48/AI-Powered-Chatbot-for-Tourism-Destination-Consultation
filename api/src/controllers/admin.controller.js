const bcrypt = require("bcryptjs");
const { Prisma } = require("@prisma/client");
const prisma = require("../lib/prisma");
const { banClerkUser, unbanClerkUser } = require("../utils/clerk");

function parseIntParam(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function pickSortDir(value, fallback = "desc") {
  return String(value || "").toLowerCase() === "asc" ? "asc" : fallback;
}

function coerceCount(value) {
  // Prisma may return COUNT as bigint in some drivers.
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  const parsed = Number.parseInt(String(value ?? "0"), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function getQuestionCountMapByUserId() {
  const rows = await prisma.$queryRaw(
    Prisma.sql`
      SELECT c.userId AS userId, COUNT(1) AS questionCount
      FROM [Message] m
      INNER JOIN [Chat] c ON m.chatId = c.id
      WHERE m.role = 'USER'
      GROUP BY c.userId
    `,
  );

  const map = new Map();
  for (const row of rows) {
    map.set(row.userId, coerceCount(row.questionCount));
  }
  return map;
}

exports.listUsers = async (req, res) => {
  const page = Math.max(1, parseIntParam(req.query.page, 1));
  const pageSize = Math.min(100, Math.max(1, parseIntParam(req.query.pageSize, 20)));
  const q = (req.query.q || "").toString().trim();
  const role = (req.query.role || "").toString().trim().toUpperCase();
  const banned = (req.query.banned || "").toString().trim().toLowerCase();
  const sortBy = (req.query.sortBy || "createdAt").toString().trim();
  const sortDir = pickSortDir(req.query.sortDir, "desc");
  const includeQuestionCounts =
    req.query.includeQuestionCounts === "1" || req.query.includeQuestionCounts === "true";

  const where = {};
  if (q) {
    where.OR = [{ email: { contains: q } }, { name: { contains: q } }];
  }
  if (role === "USER" || role === "ADMIN" || role === "SUPER_ADMIN") {
    where.role = role;
  }
  if (banned === "true" || banned === "1") {
    where.bannedAt = { not: null };
  } else if (banned === "false" || banned === "0") {
    where.bannedAt = null;
  }

  const finalWhere = Object.keys(where).length ? where : undefined;

  const orderByMap = {
    createdAt: "createdAt",
    email: "email",
    username: "name",
    role: "role",
    bannedAt: "bannedAt",
  };
  const orderByField = orderByMap[sortBy] || "createdAt";
  const orderBy = { [orderByField]: sortDir };

  const [total, users] = await Promise.all([
    prisma.user.count({ where: finalWhere }),
    prisma.user.findMany({
      where: finalWhere,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        clerkUserId: true,
        bannedAt: true,
        banReason: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  if (!includeQuestionCounts) {
    const items = users.map((u) => ({
      ...u,
      username: u.name,
      name: undefined,
      banned: Boolean(u.bannedAt),
    }));
    return res.json({ page, pageSize, total, items });
  }

  const countMap = await getQuestionCountMapByUserId();
  const items = users.map((u) => ({
    ...u,
    username: u.name,
    name: undefined,
    banned: Boolean(u.bannedAt),
    questionCount: countMap.get(u.id) || 0,
  }));

  return res.json({ page, pageSize, total, items });
};

exports.getUser = async (req, res) => {
  const id = parseIntParam(req.params.id, NaN);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ message: "Invalid user id" });
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      clerkUserId: true,
      bannedAt: true,
      banReason: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) return res.status(404).json({ message: "User not found" });

  const countMap = await getQuestionCountMapByUserId();
  return res.json({
    ...user,
    username: user.name,
    name: undefined,
    banned: Boolean(user.bannedAt),
    questionCount: countMap.get(user.id) || 0,
  });
};

exports.createUser = async (req, res) => {
  const { username, name, email, password, role } = req.body || {};
  const finalUsername = String(username || name || "").trim();

  if (!finalUsername || !email || !password) {
    return res.status(400).json({ message: "Missing fields" });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const exist = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (exist) return res.status(400).json({ message: "Email already exists" });

  const hashed = await bcrypt.hash(String(password), 10);

  const user = await prisma.user.create({
    data: {
      name: finalUsername,
      email: normalizedEmail,
      password: hashed,
      role:
        role === "SUPER_ADMIN"
          ? req.user?.role === "SUPER_ADMIN"
            ? "SUPER_ADMIN"
            : "USER"
          : role === "ADMIN"
            ? req.user?.role === "SUPER_ADMIN"
              ? "ADMIN"
              : "USER"
            : "USER",
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      clerkUserId: true,
      bannedAt: true,
      banReason: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return res.status(201).json({ ...user, username: user.name, name: undefined, banned: Boolean(user.bannedAt) });
};

exports.updateUser = async (req, res) => {
  const id = parseIntParam(req.params.id, NaN);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ message: "Invalid user id" });
  }

  const { username, name, email, password, role } = req.body || {};

  const data = {};
  const finalUsername = typeof username === "string" ? username.trim() : typeof name === "string" ? name.trim() : "";
  if (finalUsername) data.name = finalUsername;
  if (typeof email === "string" && email.trim()) data.email = email.trim().toLowerCase();
  if (typeof role === "string") {
    const requested = role === "SUPER_ADMIN" ? "SUPER_ADMIN" : role === "ADMIN" ? "ADMIN" : "USER";
    if (requested === "USER") {
      data.role = "USER";
    } else if (req.user?.role === "SUPER_ADMIN") {
      data.role = requested;
    }
  }
  if (typeof password === "string" && password) data.password = await bcrypt.hash(password, 10);

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ message: "No fields to update" });
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        clerkUserId: true,
        bannedAt: true,
        banReason: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return res.json({ ...user, username: user.name, name: undefined, banned: Boolean(user.bannedAt) });
  } catch (err) {
    // Prisma unique constraint error
    if (err && err.code === "P2002") {
      return res.status(400).json({ message: "Email already exists" });
    }
    throw err;
  }
};

function canBanTarget(actorRole, targetRole) {
  if (actorRole === "SUPER_ADMIN") return true;
  if (actorRole === "ADMIN") return targetRole === "USER";
  return false;
}

exports.banUser = async (req, res) => {
  const id = parseIntParam(req.params.id, NaN);
  if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid user id" });

  if (req.user?.id === id) {
    return res.status(400).json({ message: "Cannot ban your own account" });
  }

  const reason = (req.body?.reason || "").toString().trim() || null;

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, bannedAt: true, clerkUserId: true },
  });

  if (!target) return res.status(404).json({ message: "User not found" });
  if (!canBanTarget(req.user?.role, target.role)) return res.status(403).json({ message: "Forbidden" });

  const updated = await prisma.user.update({
    where: { id },
    data: { bannedAt: new Date(), banReason: reason },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      clerkUserId: true,
      bannedAt: true,
      banReason: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (updated.clerkUserId) {
    try {
      await banClerkUser(updated.clerkUserId);
    } catch (err) {
      // Keep DB ban even if Clerk sync fails.
      return res.status(200).json({
        ...updated,
        username: updated.name,
        name: undefined,
        banned: true,
        clerkSync: "failed",
      });
    }
  }

  return res.json({ ...updated, username: updated.name, name: undefined, banned: true, clerkSync: "ok" });
};

exports.unbanUser = async (req, res) => {
  const id = parseIntParam(req.params.id, NaN);
  if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid user id" });

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, clerkUserId: true },
  });

  if (!target) return res.status(404).json({ message: "User not found" });
  if (!canBanTarget(req.user?.role, target.role)) return res.status(403).json({ message: "Forbidden" });

  const updated = await prisma.user.update({
    where: { id },
    data: { bannedAt: null, banReason: null },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      clerkUserId: true,
      bannedAt: true,
      banReason: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (updated.clerkUserId) {
    try {
      await unbanClerkUser(updated.clerkUserId);
    } catch (err) {
      return res.status(200).json({
        ...updated,
        username: updated.name,
        name: undefined,
        banned: false,
        clerkSync: "failed",
      });
    }
  }

  return res.json({ ...updated, username: updated.name, name: undefined, banned: false, clerkSync: "ok" });
};

exports.tokenStats = async (req, res) => {
  const q = (req.query.q || "").toString().trim();
  const sortBy = (req.query.sortBy || "tokens").toString().trim();
  const sortDir = String(pickSortDir(req.query.sortDir, "desc")).toUpperCase();

  const allowedSortBy = new Set(["tokens", "email", "username"]);
  const finalSortBy = allowedSortBy.has(sortBy) ? sortBy : "tokens";
  const orderExpr =
    finalSortBy === "email"
      ? Prisma.sql`u.email`
      : finalSortBy === "username"
        ? Prisma.sql`u.name`
        : Prisma.sql`SUM(a.tokens)`;

  const like = `%${q}%`;
  const whereSql = q ? Prisma.sql`WHERE u.email LIKE ${like} OR u.name LIKE ${like}` : Prisma.sql``;

  const rows = await prisma.$queryRaw(
    Prisma.sql`
      SELECT u.id AS userId, u.email AS email, u.name AS username, SUM(a.tokens) AS tokens
      FROM [AIUsage] a
      INNER JOIN [User] u ON a.userId = u.id
      ${whereSql}
      GROUP BY u.id, u.email, u.name
      ORDER BY ${orderExpr} ${Prisma.raw(sortDir)}
    `,
  );

  const items = rows.map((r) => ({
    userId: r.userId,
    email: r.email,
    username: r.username,
    tokens: coerceCount(r.tokens),
  }));

  const totalTokens = items.reduce((sum, x) => sum + x.tokens, 0);
  return res.json({ totalTokens, items });
};

exports.deleteUser = async (req, res) => {
  const id = parseIntParam(req.params.id, NaN);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ message: "Invalid user id" });
  }

  // Prevent deleting your own account.
  if (req.user && req.user.id === id) {
    return res.status(400).json({ message: "Cannot delete your own account" });
  }

  const exist = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!exist) return res.status(404).json({ message: "User not found" });

  await prisma.user.delete({ where: { id } });
  return res.json({ message: "User deleted" });
};

exports.questionStats = async (req, res) => {
  const q = (req.query.q || "").toString().trim();

  const where = q
    ? {
        OR: [
          { email: { contains: q } },
          { name: { contains: q } },
        ],
      }
    : undefined;

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  const countMap = await getQuestionCountMapByUserId();
  const items = users.map((u) => ({
    ...u,
    username: u.name,
    name: undefined,
    questionCount: countMap.get(u.id) || 0,
  }));

  return res.json({ total: items.length, items });
};
