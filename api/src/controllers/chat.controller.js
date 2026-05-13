const prisma = require("../lib/prisma");
const {
  generateTravelResponse,
  generateTripPlanJson,
} = require("../services/ai.service");
const yahooImageSearch = require("../services/serpApi.yahooImage").yahooSearch;
const { Prisma } = require("@prisma/client");
const {
  sanitizeTripPlanPayload,
  parseBudgetNumber,
} = require("../utils/tripPlan");
const { getUserTokenLedger } = require("../utils/billing");

const QUICK_GUIDE_TOKEN = "[[ASSISTANT_GUIDE_QUICK_SUGGESTION]]";

function parseIntParam(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function truncateString(value, maxLen) {
  const s = (value ?? "").toString();
  if (!Number.isFinite(maxLen) || maxLen <= 0) return "";
  if (s.length <= maxLen) return s;
  return `${s.slice(0, Math.max(0, maxLen - 20))}\n...[truncated ${s.length - maxLen + 20} chars]`;
}

function stripInternalGuide(value) {
  const raw = String(value || "");
  if (!raw.includes(QUICK_GUIDE_TOKEN)) return raw.trim();
  return raw
    .replace(/\s*\[\[ASSISTANT_GUIDE_QUICK_SUGGESTION\]\][\s\S]*$/i, "")
    .trim();
}

async function createMessageSafe(data) {
  try {
    return await prisma.message.create({
      data,
      select: { id: true, role: true, content: true, createdAt: true },
    });
  } catch (err) {
    // If DB column is still NVARCHAR(1000), long AI output will throw P2000.
    if (
      err &&
      err.code === "P2000" &&
      err.meta &&
      err.meta.column_name === "content"
    ) {
      const content = truncateString(data.content, 950);
      return prisma.message.create({
        data: { ...data, content },
        select: { id: true, role: true, content: true, createdAt: true },
      });
    }
    throw err;
  }
}

async function requireChatOwnedByUser(chatId, userId) {
  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    select: { id: true, userId: true, title: true, createdAt: true },
  });

  if (!chat) return null;
  if (chat.userId !== userId) return "FORBIDDEN";
  return chat;
}

exports.listChats = async (req, res) => {
  const userId = req.user.id;

  const limit = Math.min(50, Math.max(1, parseIntParam(req.query.limit, 20)));
  const page = Math.max(1, parseIntParam(req.query.page, 1));
  const skip = (page - 1) * limit;

  const [total, chats] = await prisma.$transaction([
    prisma.chat.count({ where: { userId } }),
    prisma.chat.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        title: true,
        createdAt: true,
        _count: { select: { messages: true } },
      },
    }),
  ]);

  res.json({ total, page, limit, items: chats });
};

exports.createChat = async (req, res) => {
  const userId = req.user.id;
  const title = (req.body?.title || "").toString().trim();

  const chat = await prisma.chat.create({
    data: { userId, title: title || null },
    select: { id: true, title: true, createdAt: true },
  });

  res.status(201).json(chat);
};

exports.getChat = async (req, res) => {
  const userId = req.user.id;
  const chatId = parseIntParam(req.params.chatId, NaN);
  if (!Number.isFinite(chatId))
    return res.status(400).json({ message: "Invalid chatId" });

  const chat = await requireChatOwnedByUser(chatId, userId);
  if (!chat) return res.status(404).json({ message: "Chat not found" });
  if (chat === "FORBIDDEN")
    return res.status(403).json({ message: "Forbidden" });

  res.json(chat);
};

exports.updateChat = async (req, res) => {
  const userId = req.user.id;
  const chatId = parseIntParam(req.params.chatId, NaN);
  if (!Number.isFinite(chatId))
    return res.status(400).json({ message: "Invalid chatId" });

  const title = (req.body?.title || "").toString().trim();
  if (!title) return res.status(400).json({ message: "Missing fields" });

  const chat = await requireChatOwnedByUser(chatId, userId);
  if (!chat) return res.status(404).json({ message: "Chat not found" });
  if (chat === "FORBIDDEN")
    return res.status(403).json({ message: "Forbidden" });

  const updated = await prisma.chat.update({
    where: { id: chatId },
    data: { title },
    select: { id: true, title: true, createdAt: true },
  });

  res.json(updated);
};

exports.deleteChat = async (req, res) => {
  const userId = req.user.id;
  const chatId = parseIntParam(req.params.chatId, NaN);
  if (!Number.isFinite(chatId))
    return res.status(400).json({ message: "Invalid chatId" });

  const chat = await requireChatOwnedByUser(chatId, userId);
  if (!chat) return res.status(404).json({ message: "Chat not found" });
  if (chat === "FORBIDDEN")
    return res.status(403).json({ message: "Forbidden" });

  // Important: allow deleting a chat without deleting already-saved trip plans.
  // We keep trip plans by detaching them from the chat first.
  await prisma.$transaction([
    prisma.tripPlan.updateMany({ where: { chatId }, data: { chatId: null } }),
    prisma.message.deleteMany({ where: { chatId } }),
    prisma.chat.delete({ where: { id: chatId } }),
  ]);
  res.json({ message: "Chat deleted" });
};

exports.listMessages = async (req, res) => {
  const userId = req.user.id;
  const chatId = parseIntParam(req.params.chatId, NaN);
  if (!Number.isFinite(chatId))
    return res.status(400).json({ message: "Invalid chatId" });

  const chat = await requireChatOwnedByUser(chatId, userId);
  if (!chat) return res.status(404).json({ message: "Chat not found" });
  if (chat === "FORBIDDEN")
    return res.status(403).json({ message: "Forbidden" });

  const limit = Math.min(200, Math.max(1, parseIntParam(req.query.limit, 50)));
  const order =
    (req.query.order || "asc").toString().toLowerCase() === "desc"
      ? "desc"
      : "asc";

  const messages = await prisma.message.findMany({
    where: { chatId },
    orderBy: { createdAt: order },
    take: limit,
    select: { id: true, role: true, content: true, createdAt: true },
  });

  res.json({ total: messages.length, items: messages });
};

exports.ask = async (req, res) => {
  const userId = req.user.id;
  const message = stripInternalGuide((req.body?.message || "").toString());
  const guide = (req.body?.guide || "").toString().trim().toLowerCase();
  const requestedChatId = req.body?.chatId;
  const title = (req.body?.title || "").toString().trim();

  if (!message) return res.status(400).json({ message: "Missing fields" });

  // Quota check (monthly): free tokens + purchased tokens - used tokens.
  const ledger = await getUserTokenLedger(userId, new Date());
  if (ledger.remainingTokens <= 0) {
    return res.status(402).json({
      message: "Token quota exceeded for this month",
      code: "TOKEN_QUOTA_EXCEEDED",
      ledger,
    });
  }

  let chatId = null;

  if (
    requestedChatId !== undefined &&
    requestedChatId !== null &&
    requestedChatId !== ""
  ) {
    const parsedChatId = parseIntParam(requestedChatId, NaN);
    if (!Number.isFinite(parsedChatId)) {
      return res.status(400).json({ message: "Invalid chatId" });
    }

    const chat = await requireChatOwnedByUser(parsedChatId, userId);
    if (!chat) return res.status(404).json({ message: "Chat not found" });
    if (chat === "FORBIDDEN")
      return res.status(403).json({ message: "Forbidden" });
    chatId = parsedChatId;
  } else {
    const created = await prisma.chat.create({
      data: { userId, title: title || message.slice(0, 60) || null },
      select: { id: true },
    });
    chatId = created.id;
  }

  const userMsg = await createMessageSafe({
    chatId,
    role: "USER",
    content: message,
  });

  const history = await prisma.message.findMany({
    where: { chatId },
    orderBy: { createdAt: "asc" },
    select: { role: true, content: true },
  });

  const messages = history.map((m) => ({
    role: m.role.toLowerCase(), // USER -> user, ASSISTANT -> assistant
    content: stripInternalGuide(m.content),
  }));

  const {
    reply: aiReply,
    tokens,
    trip_plan: tripPlan,
    resp,
  } = await generateTravelResponse(messages, {
    guide,
  });

  const assistantContent =
    tripPlan && typeof tripPlan === "object"
      ? JSON.stringify({
          resp:
            (resp || "").toString().trim() ||
            "Cảm ơn bạn đã cung cấp đầy đủ thông tin! Dưới đây là kế hoạch chuyến đi của bạn.",
          trip_plan: tripPlan,
        })
      : aiReply;

  const assistantMsg = await createMessageSafe({
    chatId,
    role: "ASSISTANT",
    content: assistantContent,
  });
  const assistantMsgForResponse = {
    ...assistantMsg,
    content: assistantContent,
  };

  if (typeof tokens === "number" && Number.isFinite(tokens) && tokens > 0) {
    await prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO [AIUsage] (userId, tokens)
        VALUES (${userId}, ${Math.trunc(tokens)})
      `,
    );
  }

  res.json({
    chatId,
    reply: tripPlan ? (resp || "").toString().trim() || aiReply : aiReply,
    trip_plan: tripPlan || null,
    resp: resp || "",
    messages: [userMsg, assistantMsgForResponse],
  });
};

exports.listTripPlans = async (req, res) => {
  const userId = req.user.id;
  const chatId = parseIntParam(req.params.chatId, NaN);
  if (!Number.isFinite(chatId))
    return res.status(400).json({ message: "Invalid chatId" });

  const chat = await requireChatOwnedByUser(chatId, userId);
  if (!chat) return res.status(404).json({ message: "Chat not found" });
  if (chat === "FORBIDDEN")
    return res.status(403).json({ message: "Forbidden" });

  const includeData =
    String(req.query.include || "").toLowerCase() === "1" ||
    String(req.query.include || "").toLowerCase() === "true";

  const plans = await prisma.tripPlan.findMany({
    where: { chatId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      budget: true,
      createdAt: true,
    },
  });

  const items = plans.map((p) => {
    if (!includeData)
      return {
        id: p.id,
        title: p.title,
        budget: p.budget,
        createdAt: p.createdAt,
      };
    let data = null;
    try {
      data = p.description ? JSON.parse(p.description) : null;
    } catch {
      data = null;
    }
    return {
      id: p.id,
      title: p.title,
      budget: p.budget,
      createdAt: p.createdAt,
      data,
    };
  });

  res.json({ total: items.length, items });
};

// exports.generateTripPlan = async (req, res) => {
//   const userId = req.user.id;
//   const chatId = parseIntParam(req.params.chatId, NaN);
//   if (!Number.isFinite(chatId))
//     return res.status(400).json({ message: "Invalid chatId" });

//   const chat = await requireChatOwnedByUser(chatId, userId);
//   if (!chat) return res.status(404).json({ message: "Chat not found" });
//   if (chat === "FORBIDDEN")
//     return res.status(403).json({ message: "Forbidden" });

//   const origin = (req.body?.origin || "").toString().trim();
//   const destination = (req.body?.destination || "").toString().trim();
//   const duration = (req.body?.duration || "").toString().trim();
//   const budget = (req.body?.budget || "").toString().trim();
//   const group_size = (req.body?.group_size || req.body?.groupSize || "")
//     .toString()
//     .trim();
//   const interests = (req.body?.interests || "").toString().trim();
//   const preferences = (req.body?.preferences || "").toString().trim();
//   const hotelCount = req.body?.hotelCount;

//   if (!origin || !destination || !duration) {
//     return res
//       .status(400)
//       .json({ message: "Missing fields (origin, destination, duration)" });
//   }

//   const ledger = await getUserTokenLedger(userId, new Date());
//   if (ledger.remainingTokens <= 0) {
//     return res.status(402).json({
//       message: "Token quota exceeded for this month",
//       code: "TOKEN_QUOTA_EXCEEDED",
//       ledger,
//     });
//   }

//   const userInputSummary = JSON.stringify(
//     {
//       origin,
//       destination,
//       duration,
//       budget,
//       group_size,
//       interests,
//       preferences,
//     },
//     null,
//     2,
//   );

//   const userMsg = await createMessageSafe({
//     chatId,
//     role: "USER",
//     content: `Generate trip plan:\n${userInputSummary}`,
//   });

//   const { reply, tokens } = await generateTripPlanJson({
//     origin,
//     destination,
//     duration,
//     budget,
//     group_size,
//     interests,
//     preferences,
//     hotelCount,
//   });

//   let raw;
//   try {
//     raw = JSON.parse(reply);
//   } catch (err) {
//     return res
//       .status(502)
//       .json({
//         message: "AI returned invalid JSON",
//         detail: String(err?.message || "parse failed"),
//       });
//   }

//   const sanitized = sanitizeTripPlanPayload(raw);
//   if (!sanitized) {
//     return res
//       .status(502)
//       .json({ message: "AI returned JSON that does not match schema" });
//   }

//   const respText = (raw && typeof raw.resp === "string" ? raw.resp : "")
//     .toString()
//     .trim();
//   const wrapper = {
//     resp:
//       respText ||
//       "Cảm ơn bạn đã cung cấp đầy đủ thông tin! Dưới đây là kế hoạch chuyến đi của bạn.",
//     trip_plan: sanitized.trip_plan,
//   };
//   const planJson = JSON.stringify(wrapper);

//   if (typeof tokens === "number" && Number.isFinite(tokens) && tokens > 0) {
//     await prisma.$executeRaw(
//       Prisma.sql`
//         INSERT INTO [AIUsage] (userId, tokens)
//         VALUES (${userId}, ${Math.trunc(tokens)})
//       `,
//     );
//   }

//   const assistantMsg = await createMessageSafe({
//     chatId,
//     role: "ASSISTANT",
//     content: planJson,
//   });
//   const assistantMsgForResponse = { ...assistantMsg, content: planJson };

//   // Important: do NOT save to TripPlan/Destination here. Client will call save endpoint if user confirms.
//   return res.status(201).json({
//     chatId,
//     trip_plan: sanitized.trip_plan,
//     resp: wrapper.resp,
//     messages: [userMsg, assistantMsgForResponse],
//   });
// };

exports.saveTripPlan = async (req, res) => {
  const userId = req.user.id;
  const chatId = parseIntParam(req.params.chatId, NaN);
  if (!Number.isFinite(chatId))
    return res.status(400).json({ message: "Invalid chatId" });

  const chat = await requireChatOwnedByUser(chatId, userId);
  if (!chat) return res.status(404).json({ message: "Chat not found" });
  if (chat === "FORBIDDEN")
    return res.status(403).json({ message: "Forbidden" });

  const raw = req.body && typeof req.body === "object" ? req.body : null;
  const sanitized = sanitizeTripPlanPayload(raw);
  if (!sanitized)
    return res.status(400).json({ message: "Invalid trip plan payload" });

  const planJson = JSON.stringify({
    resp:
      (raw && typeof raw.resp === "string" ? raw.resp : "").toString().trim() ||
      "Kế hoạch chuyến đi đã được lưu.",
    trip_plan: sanitized.trip_plan,
  });
  const budgetNumber =
    parseBudgetNumber(sanitized.trip_plan.total_estimated_cost) ??
    parseBudgetNumber(sanitized.trip_plan.budget);

  const destinations = [];
  for (const day of sanitized.trip_plan.itinerary || []) {
    const dayNumber = Number.isFinite(day.day) ? Math.trunc(day.day) : null;
    for (const act of day.activities || []) {
      destinations.push({
        name: act.place_name,
        location: act.place_address || null,
        dayNumber,
        note: JSON.stringify({
          day_plan: day.day_plan || null,
          best_time_to_visit_day: day.best_time_to_visit_day || null,
          ...act,
        }),
      });
    }
  }

  const tripPlan = await prisma.$transaction(async (tx) => {
    const created = await tx.tripPlan.create({
      data: {
        userId,
        chatId,
        title: sanitized.trip_plan.destination,
        description: planJson,
        budget: budgetNumber,
      },
      select: { id: true, title: true, budget: true, createdAt: true },
    });

    if (destinations.length) {
      await tx.destination.createMany({
        data: destinations.map((d) => ({ ...d, tripPlanId: created.id })),
      });
    }

    return created;
  });

  return res
    .status(201)
    .json({ tripPlanId: tripPlan.id, trip_plan: sanitized.trip_plan });
};
