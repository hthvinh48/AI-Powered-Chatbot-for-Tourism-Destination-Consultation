const prisma = require("../lib/prisma");

const DEFAULT_FREE_TOKENS_PER_MONTH = 100000;
const SETTING_KEY_FREE_TOKENS = "FREE_TOKENS_PER_MONTH";

function startOfMonth(d) {
  const dt = new Date(d);
  dt.setDate(1);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function nextMonth(d) {
  const dt = startOfMonth(d);
  dt.setMonth(dt.getMonth() + 1);
  return dt;
}

async function getFreeTokensPerMonth() {
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: SETTING_KEY_FREE_TOKENS },
      select: { value: true },
    });
    const parsed = row ? Number.parseInt(String(row.value), 10) : NaN;
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  } catch {
    // ignore if table not migrated yet
  }
  return DEFAULT_FREE_TOKENS_PER_MONTH;
}

async function setFreeTokensPerMonth(value) {
  const n = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n) || n < 0)
    throw new Error("Invalid free tokens value");
  await prisma.appSetting.upsert({
    where: { key: SETTING_KEY_FREE_TOKENS },
    create: { key: SETTING_KEY_FREE_TOKENS, value: String(n) },
    update: { value: String(n) },
    select: { key: true },
  });
  return n;
}

async function getUserTokenLedger(userId, at = new Date()) {
  const from = startOfMonth(at);
  const to = nextMonth(at);

  const freeTokensPerMonth = await getFreeTokensPerMonth();

  let usedTokens = 0;
  let purchasedTokens = 0;
  let activeMember = null;

  try {
    if (prisma.aIUsage?.aggregate) {
      const usedAgg = await prisma.aIUsage.aggregate({
        where: { userId, createdAt: { gte: from, lt: to } },
        _sum: { tokens: true },
      });
      usedTokens = Number(usedAgg?._sum?.tokens || 0);
    }
  } catch {
    usedTokens = 0;
  }

  try {
    if (prisma.invoice?.aggregate) {
      const purchasedAgg = await prisma.invoice.aggregate({
        where: { userId, tokens: { gt: 0 }, status: "PAID" },
        _sum: { tokens: true },
      });
      purchasedTokens = Number(purchasedAgg?._sum?.tokens || 0);
    }
  } catch {
    purchasedTokens = 0;
  }

  try {
    if (prisma.membership?.findFirst) {
      activeMember = await prisma.membership.findFirst({
        where: {
          userId,
          status: "ACTIVE",
          startedAt: { lte: at },
          endsAt: { gt: at },
        },
        orderBy: { endsAt: "desc" },
        select: { id: true, endsAt: true },
      });
    }
  } catch {
    activeMember = null;
  }

  const isMemberActive = Boolean(activeMember && activeMember.id);
  const freeTokens = freeTokensPerMonth;
  purchasedTokens = Number(purchasedTokens || 0);
  const availableTokens = isMemberActive ? null : freeTokens + purchasedTokens;
  const remainingTokens = isMemberActive ? null : availableTokens - usedTokens;

  return {
    monthStart: from.toISOString(),
    monthEnd: to.toISOString(),
    memberActive: isMemberActive,
    membershipEndsAt: activeMember?.endsAt
      ? new Date(activeMember.endsAt).toISOString()
      : null,
    freeTokens,
    purchasedTokens,
    usedTokens,
    availableTokens,
    remainingTokens,
  };
}

module.exports = {
  DEFAULT_FREE_TOKENS_PER_MONTH,
  getFreeTokensPerMonth,
  setFreeTokensPerMonth,
  getUserTokenLedger,
  startOfMonth,
  nextMonth,
};
