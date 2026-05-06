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
  const limit = Math.min(50, Math.max(1, parseIntParam(req.query.limit, 10)));
  const page = Math.max(1, parseIntParam(req.query.page, 1));
  const skip = (page - 1) * limit;

  const [total, plans] = await prisma.$transaction([
    prisma.tripPlan.count({ where: { userId } }),
    prisma.tripPlan.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: { id: true, chatId: true, title: true, description: true, budget: true, createdAt: true },
    }),
  ]);

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

  res.json({ total, page, limit, items });
};

exports.deleteMyTripPlan = async (req, res) => {
  const userId = req.user.id;
  const tripPlanId = parseIntParam(req.params.tripPlanId, NaN);
  if (!Number.isFinite(tripPlanId)) return res.status(400).json({ message: "Invalid tripPlanId" });

  const plan = await prisma.tripPlan.findUnique({
    where: { id: tripPlanId },
    select: { id: true, userId: true },
  });

  if (!plan) return res.status(404).json({ message: "Trip plan not found" });
  if (plan.userId !== userId) return res.status(403).json({ message: "Forbidden" });

  await prisma.tripPlan.delete({ where: { id: tripPlanId } });
  res.json({ message: "Trip plan deleted" });
};
