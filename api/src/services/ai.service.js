const openai = require("../config/openai");

const QUICK_GUIDE_TOKEN = "[[ASSISTANT_GUIDE_QUICK_SUGGESTION]]";

function stripAccents(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalize(value) {
  return stripAccents(value).toLowerCase();
}

function extractJsonFromText(text) {
  const s = String(text || "");
  const fence =
    s.match(/```json\s*([\s\S]*?)```/i) || s.match(/```\s*([\s\S]*?)```/i);
  if (fence && fence[1]) return fence[1].trim();

  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first >= 0 && last > first) return s.slice(first, last + 1).trim();
  return null;
}

function extractPreambleText(text) {
  const s = String(text || "").trim();
  if (!s) return "";
  const idx = s.search(/```json/i);
  if (idx >= 0) return s.slice(0, idx).trim();
  const idx2 = s.indexOf("```");
  if (idx2 >= 0) return s.slice(0, idx2).trim();
  return "";
}

function tryExtractTripPlan(content) {
  const rawJson = extractJsonFromText(content);
  if (!rawJson) return { trip_plan: null, resp: "" };

  try {
    const obj = JSON.parse(rawJson);
    if (!obj || typeof obj !== "object") return { trip_plan: null, resp: "" };
    if (!obj.trip_plan || typeof obj.trip_plan !== "object")
      return { trip_plan: null, resp: "" };

    const resp =
      typeof obj.resp === "string"
        ? obj.resp.trim()
        : extractPreambleText(content);
    return { trip_plan: obj.trip_plan, resp };
  } catch {
    return { trip_plan: null, resp: "" };
  }
}

function stripInternalGuide(value) {
  const raw = String(value || "");
  if (!raw) return "";
  if (!raw.includes(QUICK_GUIDE_TOKEN)) return raw.trim();
  return raw.replace(/\s*\[\[ASSISTANT_GUIDE_QUICK_SUGGESTION\]\][\s\S]*$/i, "").trim();
}

function looksLikeStructuredPlanInput(value) {
  const text = String(value || "");
  return /(^|\n)\s*(origin|destination|duration|budget|group_size|interests|preferences)\s*[:=]/i.test(text);
}

function isQuickSuggestionIntent(value) {
  const text = normalize(value);
  if (!text) return false;
  const suggestSignals = [
    "goi y",
    "de xuat",
    "nen di dau",
    "di dau",
    "choi gi",
    "an gi",
    "recommend",
    "suggest",
    "where to go",
    "places to visit",
    "travel spots",
  ];
  const locationSignals = [
    "ha noi",
    "hanoi",
    "ho chi minh",
    "sai gon",
    "da nang",
    "can tho",
    "nha trang",
    "hue",
    "da lat",
    "quy nhon",
  ];
  const hasSuggestSignal = suggestSignals.some((k) => text.includes(k));
  const hasLocationSignal = locationSignals.some((k) => text.includes(k));
  const hasPlacePattern = /\b(o|tai|in|at|near)\b\s+.{2,}/i.test(text);
  return hasSuggestSignal && (hasLocationSignal || hasPlacePattern);
}

function getLastUserMessage(messages) {
  if (!Array.isArray(messages)) return "";
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (String(msg?.role || "").toLowerCase() !== "user") continue;
    return String(msg?.content || "").trim();
  }
  return "";
}

const SYSTEM_PROMPT = `
You are an expert AI Trip Planner assistant.

First decide intent:
1) QUICK RECOMMENDATION intent
2) FULL TRIP PLAN intent

QUICK RECOMMENDATION intent examples:
- "goi y dia diem du lich o Ha Noi"
- "nen di dau o Da Nang"
- "recommend places in HCMC"

For QUICK RECOMMENDATION intent:
- Reply directly with useful suggestions.
- Keep it concise, friendly, practical.
- Do NOT require mandatory full-plan fields (origin/group size/budget/days) when user only asks quick suggestions.
- If budget is unknown, suggest options by budget level (budget / medium / premium).
- Return plain text only (no JSON required).

FULL TRIP PLAN intent:
- User explicitly asks for complete itinerary OR provides structured planning fields.
- In this mode, output JSON with exact shape:
{
  "resp": "string",
  "trip_plan": {
    "destination": "string",
    "duration": "string",
    "origin": "string",
    "budget": "string",
    "group_size": "string",
    "currency": "VND",
    "total_estimated_cost": "string",
    "hotels": [ { "hotel_name": "string", "hotel_address": "string", "price_per_night": "string", "hotel_image_url": "string", "geo_coordinates": { "latitude": number, "longitude": number }, "rating": number, "description": "string" } ],
    "places_to_visit": "Array of all place objects mentioned in itinerary",
    "itinerary": [
      {
        "day": number,
        "day_plan": "string",
        "estimated_cost": "string",
        "activities": [
          {
            "place_name": "string",
            "place_details": "string",
            "place_image_url": "string",
            "geo_coordinates": { "latitude": number, "longitude": number },
            "place_address": "string",
            "ticket_pricing": "string",
            "time_travel_each_location": "string",
            "best_time_to_visit": "Morning | Afternoon | Evening"
          }
        ]
      }
    ]
  }
}

Vietnamese wording preference:
- "origin" => "diem khoi hanh" or "diem xuat phat"
- avoid translating it as "nguon goc"
- If you ask follow-up in Vietnamese, use this exact friendly label set:
  [Điểm khởi hành], [Điểm đến], [Số người], [Ngân sách], [Số ngày], [Sở thích], [Yêu cầu đặc biệt]

Language:
- Use Vietnamese for Vietnamese input.
`;

async function generateTravelResponse(messages, options = {}) {
  try {
    const safeMessages = Array.isArray(messages)
      ? messages.map((m) => ({
          role: String(m?.role || "").toLowerCase(),
          content: stripInternalGuide(m?.content),
        }))
      : [];

    const lastUser = stripInternalGuide(getLastUserMessage(safeMessages));
    const guide = String(options?.guide || "").trim().toLowerCase();
    const quickByGuide = guide === "quick_suggestion";
    const quickByToken = String(getLastUserMessage(messages)).includes(QUICK_GUIDE_TOKEN);
    const quickByHeuristic =
      !looksLikeStructuredPlanInput(lastUser) && isQuickSuggestionIntent(lastUser);
    const isQuickMode = quickByGuide || quickByToken || quickByHeuristic;

    const extraSystemHint = isQuickMode
      ? "Current intent is QUICK RECOMMENDATION. Reply directly with suggestions and do not force collecting full fields."
      : "If user asks for full itinerary, output JSON exactly as requested.";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "system", content: extraSystemHint },
        ...safeMessages,
      ],
      temperature: 0.6,
    });

    const content = completion.choices[0].message.content;
    const extracted = tryExtractTripPlan(content);

    return {
      reply: content,
      trip_plan: extracted.trip_plan,
      resp: extracted.resp,
      tokens: completion.usage?.total_tokens ?? null,
    };
  } catch (error) {
    console.error("OpenAI Error:", error);
    throw new Error("AI generation failed");
  }
}

async function generateTripPlanJson(input) {
  try {
    const origin = (input?.origin || "").toString().trim();
    const destination = (input?.destination || "").toString().trim();
    const duration = (input?.duration || "").toString().trim();
    const budget = (input?.budget || "").toString().trim();
    const group_size = (input?.group_size || "").toString().trim();
    const interests = (input?.interests || "").toString().trim();
    const preferences = (input?.preferences || "").toString().trim();
    const hotelCount = Math.min(
      8,
      Math.max(3, Number.parseInt(String(input?.hotelCount || 5), 10) || 5),
    );

    const sys = `You are a travel planner that MUST output valid JSON only.

Generate a travel plan given the input details.
- Provide a list of places to visit (top-level places_to_visit).
- Provide an array of hotel options (size: ${hotelCount}).
- Provide a day-by-day itinerary with multiple activities each day (at least 3 activities per day if duration >= 2 days).
- Include estimated costs:
  - trip_plan.total_estimated_cost = total for the whole trip (in the currency you choose).
  - itinerary[].estimated_cost = per-day estimate (include accommodation + food + transport + tickets).
- Use realistic-sounding information, but if unsure, use safe placeholders.
- All image URLs must be valid-looking https URLs (placeholders allowed).
- All geo coordinates must be numbers.
- Output MUST match the schema exactly (field names/types).
- Do not include any extra keys.

Output schema (JSON):
{
  "resp":"string",
  "trip_plan":{
     "destination":"string",
     "duration":"string",
     "origin":"string",
     "budget":"string",
     "group_size":"string",
     "currency":"string",
     "total_estimated_cost":"string",
     "hotels":[
      {
         "hotel_name":"string",
         "hotel_address":"string",
         "price_per_night":"string",
         "hotel_image_url":"string",
         "geo_coordinates":{
           "latitude":"number",
           "longitude":"number"
         },
         "rating":"number",
         "description":"string"
       }
      ],
     "places_to_visit":[
       {
        "place_name":"string",
        "place_details":"string",
        "place_image_url":"string",
        "geo_coordinates":{
          "latitude":"number",
          "longitude":"number"
        },
        "place_address":"string",
        "ticket_pricing":"string",
        "best_time_to_visit":"string"
       }
     ],
     "itinerary":[
       {
          "day":"number",
          "day_plan":"string",
          "best_time_to_visit_day":"string",
          "estimated_cost":"string",
          "activities":[
           {
            "place_name":"string",
            "place_details":"string",
            "place_image_url":"string",
            "geo_coordinates":{
               "latitude":"number",
               "longitude":"number"
             },
             "place_address":"string",
             "ticket_pricing":"string",
             "time_travel_each_location":"string",
             "best_time_to_visit":"string"
            }
           ]
        }
     ]
   }
 }`;

    const user = {
      origin,
      destination,
      duration,
      budget,
      group_size,
      interests,
      preferences,
    };

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: sys },
        {
          role: "user",
          content: `Return Vietnamese-friendly "resp" like: "Cảm ơn bạn đã cung cấp đủ thông tin. Dưới đây là kế hoạch chuyến đi của bạn." Then return the plan.\n\nInput:\n${JSON.stringify(
            user,
          )}`,
        },
      ],
    });

    return {
      reply: completion.choices[0].message.content,
      tokens: completion.usage?.total_tokens ?? null,
    };
  } catch (error) {
    console.error("OpenAI Error:", error);
    throw new Error("AI generation failed");
  }
}

module.exports = {
  generateTravelResponse,
  generateTripPlanJson,
};
