const { log } = require("node:console");
const prisma = require("../lib/prisma");
const vnpayService = require("../services/Vnpay.service");

function parseIntParam(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseFloatParam(value, fallback) {
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

const {
  getFreeTokensPerMonth,
  getUserTokenLedger,
} = require("../utils/billing");

exports.getSummary = async (req, res) => {
  const userId = req.user.id;

  const now = new Date();
  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [usedAll, used30d, used7d, purchasedAll] = await prisma.$transaction([
    prisma.aIUsage.aggregate({
      where: { userId },
      _sum: { tokens: true },
    }),
    prisma.aIUsage.aggregate({
      where: { userId, createdAt: { gte: since30d } },
      _sum: { tokens: true },
    }),
    prisma.aIUsage.aggregate({
      where: { userId, createdAt: { gte: since7d } },
      _sum: { tokens: true },
    }),
    prisma.tokenPurchase.aggregate({
      where: { userId, status: "PAID" },
      _sum: { tokens: true },
    }),
  ]);

  const totalUsedTokens = Number(usedAll?._sum?.tokens || 0);
  const usedTokens30d = Number(used30d?._sum?.tokens || 0);
  const usedTokens7d = Number(used7d?._sum?.tokens || 0);
  const totalPurchasedTokens = Number(purchasedAll?._sum?.tokens || 0);
  const freePerMonth = await getFreeTokensPerMonth();
  const ledgerMonth = await getUserTokenLedger(userId, now);

  return res.json({
    totalUsedTokens,
    usedTokens30d,
    usedTokens7d,
    totalPurchasedTokens,
    freeTokensPerMonth: freePerMonth,
    month: ledgerMonth,
    balanceTokens: Math.max(0, ledgerMonth.availableTokens - totalUsedTokens),
  });
};

exports.listPurchases = async (req, res) => {
  const userId = req.user.id;
  const limit = Math.min(50, Math.max(1, parseIntParam(req.query.limit, 10)));
  const page = Math.max(1, parseIntParam(req.query.page, 1));
  const skip = (page - 1) * limit;

  const [total, purchases] = await prisma.$transaction([
    prisma.tokenPurchase.count({ where: { userId } }),
    prisma.tokenPurchase.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        tokens: true,
        amount: true,
        currency: true,
        status: true,
        provider: true,
        note: true,
        createdAt: true,
      },
    }),
  ]);

  return res.json({ total, page, limit, items: purchases });
};

function addMonths(d, months) {
  const dt = new Date(d);
  dt.setMonth(dt.getMonth() + months);
  return dt;
}

function getClientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.trim()) return xf.split(",")[0].trim();
  return req.socket?.remoteAddress || req.ip || "127.0.0.1";
}

exports.getMembership = async (req, res) => {
  const userId = req.user.id;
  const now = new Date();
  const active = await prisma.membership.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      startedAt: { lte: now },
      endsAt: { gt: now },
    },
    orderBy: { endsAt: "desc" },
    select: {
      id: true,
      status: true,
      amount: true,
      currency: true,
      provider: true,
      startedAt: true,
      endsAt: true,
      createdAt: true,
    },
  });
  res.json({ active: active || null });
};

exports.createMembership = async (req, res) => {
  const userId = req.user.id;
  const now = new Date();

  const existing = await prisma.membership.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      startedAt: { lte: now },
      endsAt: { gt: now },
    },
    orderBy: { endsAt: "desc" },
    select: { id: true, endsAt: true },
  });
  if (existing) {
    return res
      .status(200)
      .json({ message: "Already active", activeUntil: existing.endsAt });
  }

  const amount =
    req.body?.amount != null ? parseFloatParam(req.body.amount, 2) : 2;
  const currency = (req.body?.currency || "USD").toString().trim() || "USD";
  const provider =
    (req.body?.provider || "manual").toString().trim() || "manual";
  const note = (req.body?.note || "").toString().trim() || null;

  const created = await prisma.$transaction(async (tx) => {
    const membership = await tx.membership.create({
      data: {
        userId,
        status: "ACTIVE",
        amount: Number.isFinite(amount) ? amount : 2,
        currency,
        provider,
        note,
        startedAt: now,
        endsAt: addMonths(now, 1),
      },
      select: {
        id: true,
        status: true,
        amount: true,
        currency: true,
        provider: true,
        startedAt: true,
        endsAt: true,
        createdAt: true,
      },
    });

    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const description = `INV-${y}${m}-MEM-${membership.id}`;

    const invoice = await tx.invoice.create({
      data: {
        userId,
        membershipId: membership.id,
        description,
        status: "PAID",
        amount: membership.amount,
        currency: membership.currency,
        tokens: 0,
        provider: membership.provider,
        note: membership.note,
        issuedAt: now,
      },
      select: { id: true, description: true },
    });

    return { membership, invoice };
  });

  res
    .status(201)
    .json({ membership: created.membership, invoice: created.invoice });
};

exports.createMembershipVnpay = async (req, res) => {
  const userId = req.user.id;
  const now = new Date();

  const existing = await prisma.membership.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      startedAt: { lte: now },
      endsAt: { gt: now },
    },
    orderBy: { endsAt: "desc" },
    select: { id: true, endsAt: true },
  });
  if (existing) {
    return res
      .status(200)
      .json({ message: "Already active", activeUntil: existing.endsAt });
  }

  const amountVnd = Number.parseInt(
    process.env.MEMBERSHIP_PRICE_VND || "50000",
    10,
  );
  const txnRef = Date.now().toString();

  const created = await prisma.$transaction(async (tx) => {
    const membership = await tx.membership.create({
      data: {
        userId,
        status: "PENDING",
        amount: amountVnd,
        currency: "VND",
        provider: "vnpay",
        note: "membership monthly",
        paymentRef: txnRef,
        startedAt: now,
        endsAt: addMonths(now, 1),
      },
      select: {
        id: true,
        status: true,
        amount: true,
        currency: true,
        provider: true,
        startedAt: true,
        endsAt: true,
        createdAt: true,
        paymentRef: true,
      },
    });

    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const description = `INV-${y}${m}-MEM-${membership.id}-${Date.now()}`;

    const invoice = await tx.invoice.create({
      data: {
        userId,
        membershipId: membership.id,
        description,
        status: "PENDING",
        amount: membership.amount,
        currency: membership.currency,
        tokens: 0,
        provider: membership.provider,
        note: membership.note,
        issuedAt: now,
      },
      select: { id: true, description: true },
    });

    return { membership, invoice };
  });

  const publicApiBase =
    process.env.PUBLIC_API_URL ||
    process.env.VNP_RETURNURL ||
    "http://localhost:5173";
  const returnUrl = `${publicApiBase}/api/billing/membership/vnpay/return`;
  const paymentUrl = vnpayService.createPaymentUrl({
    amount: amountVnd,
    orderInfo: `Membership monthly - user:${userId} - mid:${created.membership.id}`,
    ipAddr: getClientIp(req),
    txnRef,
    returnUrl,
  });

  res.status(201).json({
    paymentUrl,
    membership: created.membership,
    invoice: created.invoice,
  });
};

exports.handleMembershipVnpayReturn = async (req, res) => {
  const wantsJson =
    String(req.query?.format || "").toLowerCase() === "json" ||
    String(req.query?.json || "") === "1" ||
    String(req.headers.accept || "").includes("application/json");

  const ok = vnpayService.verifyReturnUrl(req.query || {});
  const code = String(req.query?.vnp_ResponseCode || "");
  const txnRef = String(req.query?.vnp_TxnRef || "");
  const transactionNo = String(req.query?.vnp_BankTranNo || "");

  const frontend = process.env.VNP_RETURNURL || "http://localhost:5173";
  if (!ok || !txnRef) {
    if (wantsJson) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_SIGNATURE_OR_TXNREF",
        responseCode: code || null,
        txnRef: txnRef || null,
      });
    }
    return res.redirect(`${frontend}/billing?pay=fail`);
  }

  const membership = await prisma.membership.findFirst({
    where: { paymentRef: txnRef },
    select: { id: true, userId: true, status: true },
  });
  if (!membership) {
    if (wantsJson) {
      return res.status(404).json({
        ok: false,
        error: "MEMBERSHIP_NOT_FOUND",
        responseCode: code || null,
        txnRef,
      });
    }
    return res.redirect(`${frontend}/billing?pay=fail`);
  }

  if (code === "00") {
    await prisma.$transaction([
      prisma.membership.update({
        where: { id: membership.id },
        data: { status: "ACTIVE" },
      }),
      prisma.invoice.updateMany({
        where: { membershipId: membership.id },
        data: {
          transactionNo: transactionNo,
          invoiceNo: txnRef,
          status: "PAID",
        },
      }),
    ]);
    if (wantsJson) {
      return res.json({
        ok: true,
        responseCode: code,
        txnRef,
        membershipId: membership.id,
        invoiceStatus: "PAID",
      });
    }
    return res.redirect(`${frontend}/billing?pay=success`);
  }

  await prisma.$transaction([
    prisma.membership.update({
      where: { id: membership.id },
      data: { status: "FAILED" },
    }),
    prisma.invoice.updateMany({
      where: { membershipId: membership.id },
      data: { status: "FAILED" },
    }),
  ]);
  if (wantsJson) {
    return res.status(400).json({
      ok: false,
      responseCode: code || null,
      txnRef,
      membershipId: membership.id,
      invoiceStatus: "FAILED",
    });
  }
  return res.redirect(`${frontend}/billing?pay=fail`);
};

exports.createPurchase = async (req, res) => {
  const userId = req.user.id;

  const tokens = parseIntParam(req.body?.tokens, NaN);
  if (!Number.isFinite(tokens) || tokens <= 0) {
    return res.status(400).json({ message: "Invalid tokens" });
  }

  const amount =
    req.body?.amount != null ? parseFloatParam(req.body.amount, null) : null;
  const currency = (req.body?.currency || "VND").toString().trim() || "VND";
  const provider =
    (req.body?.provider || "manual").toString().trim() || "manual";
  const note = (req.body?.note || "").toString().trim() || null;
  const status = (req.body?.status || "PAID").toString().trim() || "PAID";

  const allowedStatus = new Set(["PAID", "PENDING", "FAILED", "REFUNDED"]);
  const finalStatus = allowedStatus.has(status.toUpperCase())
    ? status.toUpperCase()
    : "PAID";

  const created = await prisma.$transaction(async (tx) => {
    const purchase = await tx.tokenPurchase.create({
      data: {
        userId,
        tokens: Math.trunc(tokens),
        amount: amount == null ? null : amount,
        currency,
        provider,
        note,
        status: finalStatus,
      },
      select: {
        id: true,
        tokens: true,
        amount: true,
        currency: true,
        status: true,
        provider: true,
        note: true,
        createdAt: true,
      },
    });

    const y = new Date().getFullYear();
    const m = String(new Date().getMonth() + 1).padStart(2, "0");
    const description = `INV-${y}${m}-TOK-${purchase.id}`;

    const invoice = await tx.invoice.create({
      data: {
        userId,
        tokenPurchaseId: purchase.id,
        description,
        status: purchase.status,
        amount: purchase.amount,
        currency: purchase.currency,
        tokens: purchase.tokens,
        provider: purchase.provider,
        note: purchase.note,
      },
      select: { id: true, description: true },
    });

    return {
      ...purchase,
      invoiceId: invoice.id,
      invoiceNumber: invoice.description,
    };
  });

  return res.status(201).json(created);
};

exports.deletePurchase = async (req, res) => {
  const userId = req.user.id;
  const id = parseIntParam(req.params.id, NaN);
  if (!Number.isFinite(id))
    return res.status(400).json({ message: "Invalid id" });

  const exist = await prisma.tokenPurchase.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });
  if (!exist) return res.status(404).json({ message: "Not found" });
  if (exist.userId !== userId)
    return res.status(403).json({ message: "Forbidden" });

  await prisma.tokenPurchase.delete({ where: { id } });
  return res.json({ message: "Deleted" });
};

exports.listInvoices = async (req, res) => {
  const userId = req.user.id;
  const limit = Math.min(50, Math.max(1, parseIntParam(req.query.limit, 10)));
  const page = Math.max(1, parseIntParam(req.query.page, 1));
  const skip = (page - 1) * limit;

  const [total, items] = await prisma.$transaction([
    prisma.invoice.count({ where: { userId } }),
    prisma.invoice.findMany({
      where: { userId },
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
        note: true,
        issuedAt: true,
        createdAt: true,
      },
    }),
  ]);

  res.json({ total, page, limit, items });
};

exports.getInvoice = async (req, res) => {
  const userId = req.user.id;
  const id = parseIntParam(req.params.id, NaN);
  if (!Number.isFinite(id))
    return res.status(400).json({ message: "Invalid id" });

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      transactionNo: true,
      invoiceNo: true,
      description: true,
      status: true,
      tokens: true,
      amount: true,
      currency: true,
      provider: true,
      note: true,
      issuedAt: true,
      createdAt: true,
      tokenPurchaseId: true,
    },
  });
  if (!invoice) return res.status(404).json({ message: "Not found" });
  if (invoice.userId !== userId)
    return res.status(403).json({ message: "Forbidden" });

  res.json(invoice);
};
