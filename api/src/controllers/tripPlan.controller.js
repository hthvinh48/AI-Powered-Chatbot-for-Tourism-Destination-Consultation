const prisma = require("../lib/prisma");

function parseIntParam(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

exports.listMyTripPlans = async (req, res) => {
  const userId = req.user.id;
  const includeData =
    String(req.query.include || "").toLowerCase() === "1" ||
    String(req.query.include || "").toLowerCase() === "true";
  const limit = Math.min(200, Math.max(1, parseIntParam(req.query.limit, 50)));

  const plans = await prisma.tripPlan.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, chatId: true, title: true, description: true, budget: true, createdAt: true },
  });

  const items = plans.map((p) => {
    if (!includeData) {
      return { id: p.id, chatId: p.chatId, title: p.title, budget: p.budget, createdAt: p.createdAt };
    }
    let data = null;
    try {
      data = p.description ? JSON.parse(p.description) : null;
    } catch {
      data = null;
    }
    return { id: p.id, chatId: p.chatId, title: p.title, budget: p.budget, createdAt: p.createdAt, data };
  });

  res.json({ total: items.length, items });
};

