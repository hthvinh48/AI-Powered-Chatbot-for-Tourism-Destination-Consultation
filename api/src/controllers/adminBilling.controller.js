const prisma = require("../lib/prisma");
const { Prisma } = require("@prisma/client");
const {
  getFreeTokensPerMonth,
  setFreeTokensPerMonth,
  startOfMonth,
  nextMonth,
} = require("../utils/billing");

function parseIntParam(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function pickSortDir(dir, fallback) {
  const d = String(dir || "").toLowerCase();
  if (d === "asc" || d === "desc") return d;
  return fallback;
}

function parseMonthParam(value) {
  const s = String(value || "").trim();
  if (!s) return new Date();
  // Accept YYYY-MM or ISO date
  const m = s.match(/^(\d{4})-(\d{2})$/);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    if (year >= 2000 && year <= 2100 && month >= 1 && month <= 12) {
      return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    }
  }
  const dt = new Date(s);
  if (Number.isFinite(dt.getTime())) return dt;
  return new Date();
}

exports.getFreeTokensSetting = async (req, res) => {
  const freeTokensPerMonth = await getFreeTokensPerMonth();
  res.json({ freeTokensPerMonth });
};

exports.updateFreeTokensSetting = async (req, res) => {
  const value = parseIntParam(req.body?.freeTokensPerMonth, NaN);
  if (!Number.isFinite(value) || value < 0)
    return res.status(400).json({ message: "Invalid freeTokensPerMonth" });
  const updated = await setFreeTokensPerMonth(value);
  res.json({ freeTokensPerMonth: updated });
};

exports.monthlyUserTokenStats = async (req, res) => {
  const month = parseMonthParam(req.query.month);
  const from = startOfMonth(month);
  const to = nextMonth(month);

  const q = (req.query.q || "").toString().trim();
  const sortBy = (req.query.sortBy || "used").toString().trim();
  const sortDir = pickSortDir(req.query.sortDir, "desc");

  const limit = Math.min(50, Math.max(1, parseIntParam(req.query.limit, 10)));
  const page = Math.max(1, parseIntParam(req.query.page, 1));
  const skip = (page - 1) * limit;

  const like = `%${q}%`;
  const whereSql = q
    ? Prisma.sql`WHERE u.email LIKE ${like} OR u.name LIKE ${like}`
    : Prisma.sql``;

  const allowedSortBy = new Set([
    "used",
    "purchased",
    "remaining",
    "email",
    "username",
  ]);
  const finalSortBy = allowedSortBy.has(sortBy) ? sortBy : "used";

  const freePerMonth = await getFreeTokensPerMonth();

  const orderExpr =
    finalSortBy === "email"
      ? Prisma.sql`u.email`
      : finalSortBy === "username"
        ? Prisma.sql`u.name`
        : finalSortBy === "purchased"
          ? Prisma.sql`COALESCE(p.purchasedTokens, 0)`
          : finalSortBy === "remaining"
            ? Prisma.sql`(${freePerMonth} + COALESCE(p.purchasedTokens, 0) - COALESCE(a.usedTokens, 0))`
            : Prisma.sql`COALESCE(a.usedTokens, 0)`;

  const [rows, totalRow] = await prisma.$transaction([
    prisma.$queryRaw(
      Prisma.sql`
        SELECT
          u.id AS userId,
          u.email AS email,
          u.name AS username,
          COALESCE(a.usedTokens, 0) AS usedTokens,
          COALESCE(p.purchasedTokens, 0) AS purchasedTokens
        FROM [User] u
        LEFT JOIN (
          SELECT userId, SUM(tokens) AS usedTokens
          FROM [AIUsage]
          WHERE createdAt >= ${from} AND createdAt < ${to}
          GROUP BY userId
        ) a ON a.userId = u.id
        LEFT JOIN (
          SELECT userId, SUM(tokens) AS purchasedTokens
          FROM [TokenPurchase]
          WHERE status = 'PAID' AND createdAt >= ${from} AND createdAt < ${to}
          GROUP BY userId
        ) p ON p.userId = u.id
        ${whereSql}
        ORDER BY ${orderExpr} ${Prisma.raw(sortDir.toUpperCase())}
        OFFSET ${skip} ROWS FETCH NEXT ${limit} ROWS ONLY
      `,
    ),
    prisma.$queryRaw(
      Prisma.sql`
        SELECT COUNT(1) AS total
        FROM [User] u
        ${whereSql}
      `,
    ),
  ]);

  const total = Number(totalRow?.[0]?.total || 0);
  const items = rows.map((r) => {
    const usedTokens = Number(r.usedTokens || 0);
    const purchasedTokens = Number(r.purchasedTokens || 0);
    const availableTokens = freePerMonth + purchasedTokens;
    const remainingTokens = availableTokens - usedTokens;
    return {
      userId: r.userId,
      email: r.email,
      username: r.username,
      usedTokens,
      purchasedTokens,
      freeTokens: freePerMonth,
      availableTokens,
      remainingTokens,
    };
  });

  res.json({
    month: from.toISOString().slice(0, 7),
    freeTokensPerMonth: freePerMonth,
    total,
    page,
    limit,
    items,
  });
};

exports.listInvoices = async (req, res) => {
  const q = (req.query.q || "").toString().trim();
  const month = parseMonthParam(req.query.month);
  const from = startOfMonth(month);
  const to = nextMonth(month);

  const limit = Math.min(50, Math.max(1, parseIntParam(req.query.limit, 10)));
  const page = Math.max(1, parseIntParam(req.query.page, 1));
  const skip = (page - 1) * limit;

  const where = {
    issuedAt: { gte: from, lt: to },
    ...(q
      ? {
          OR: [
            { user: { email: { contains: q } } },
            { user: { name: { contains: q } } },
          ],
        }
      : {}),
  };

  const [total, items] = await prisma.$transaction([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      orderBy: { issuedAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        transactionNo: true,
        invoiceNo: true,
        description: true,
        status: true,
        tokens: true,
        amount: true,
        currency: true,
        provider: true,
        issuedAt: true,
        user: { select: { id: true, email: true, name: true } },
      },
    }),
  ]);

  res.json({
    total,
    page,
    limit,
    items,
    month: from.toISOString().slice(0, 7),
  });
};
