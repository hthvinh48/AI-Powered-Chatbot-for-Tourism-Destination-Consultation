const { log } = require("node:console");
const openai = require("../config/openai");

const QUICK_GUIDE_TOKEN = "[[ASSISTANT_GUIDE_QUICK_SUGGESTION]]";
const { searchHotelsByArea } = require("./liteApi.hotelService");

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
  return raw
    .replace(/\s*\[\[ASSISTANT_GUIDE_QUICK_SUGGESTION\]\][\s\S]*$/i, "")
    .trim();
}

function looksLikeStructuredPlanInput(value) {
  const text = String(value || "");
  return /(^|\n)\s*(origin|destination|duration|budget|group_size|interests|preferences)\s*[:=]/i.test(
    text,
  );
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

### PHASE 1: INTENT CLASSIFICATION
1) QUICK RECOMMENDATION: User asks for generic advice. Reply in plain text.
2) FULL TRIP PLAN: User provides trip details or asks for "lịch trình/kế hoạch".

### PHASE 2: DATA COLLECTION & STRICT VALIDATION (IMPORTANT)
- Scan for 7 fields: [Điểm xuất phát], [Điểm đến], [Số người], [Ngân sách], [Số ngày], [Sở thích], [Yêu cầu đặc biệt].
- **RULE 1**: Nếu người dùng CHƯA cung cấp đủ ít nhất 5/7 thông tin, bạn KHÔNG ĐƯỢC tạo lịch trình ngay. 
- **RULE 2**: Phải hỏi từng thông tin còn thiếu một cách thân thiện. Chỉ khi người dùng nói "Ok", "Tiến hành đi" hoặc cung cấp đủ thông tin, bạn mới chuyển sang PHASE 4 & 5.
- Kết thúc câu hỏi phải có UI Tag tương ứng (Vd: Component: tripDuration).

### PHASE 3: JSON GENERATION RULES (ANTI-EMPTY)
1. **FULL DAY DENSITY**: Mỗi ngày PHẢI có ít nhất 4-5 hoạt động (Sáng/Trưa/Chiều/Tối). Cấm liệt kê hoạt động chung chung dưới dạng text đơn giản.
2. **ACTIVITY OBJECTS**: Mọi hoạt động phải là một object đầy đủ (place_name, place_details, coordinates, address, image_url).
3. **PLACES TO VISIT**: Phải có 5-8 địa điểm gợi ý KHÁC ngoài lịch trình chính để người dùng tham khảo thêm.

### PHASE 4: HOTEL SEARCH REQUEST (LITEAPI)
Trước khi xuất lịch trình, bạn PHẢI tạo khối JSON để gọi API tìm kiếm khách sạn thực tế. 
- cityName: Tên thành phố bằng tiếng Anh (Vd: "Da Nang").
- Format, chỉ gửi json thuần túy, không kèm text giải thích vì đây là payload để gọi API không có đưa cho người dùng xem. Nếu thấy người dùng có ý định hỏi về khách sạn, hãy chủ động tạo payload này.:
{
  "suggested_hotels": {
    "countryCode": "VN",
    "cityName": "Da Nang",
    "limit": 30,
    "offset": 0
  }
}

### PHASE 5: OUTPUT SCHEMA (STRICT JSON)
Có thể lấy thông tin khách sạn từ phản hồi API ở PHASE 4 để điền vào phần "hotels" trong lịch trình nếu có.
image_url có thể là URL thật hoặc thumbnail. Nếu không có ảnh, để trống chuỗi.
Toàn bộ phản hồi phải nằm trong 1 khối JSON duy nhất, có tiền tố "Component: final".
{
  "resp": "string (Tóm tắt thân thiện)",
  "hotel_api_call": { ... },
  "trip_plan": {
    "destination": "string",
    "duration": "string",
    "origin": "string",
    "budget": "string",
    "hotels": [ { "hotel_name": "string", "description": "Lý do chọn...", "image_url": "String or thumbnail URL" } ],
    "places_to_visit": [ { "place_name": "string", "place_address": "string", "geo_coordinates": {...} } ],
    "itinerary": [
      {
        "day": number,
        "activities": [ { "place_name": "string", "place_details": "string", "place_address": "string", "geo_coordinates": {...} } ]
      }
    ]
  }
}

### LANGUAGE
- Vietnamese output. Thân thiện, chuyên nghiệp.
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
    const guide = String(options?.guide || "")
      .trim()
      .toLowerCase();
    const quickByGuide = guide === "quick_suggestion";
    const quickByToken = String(getLastUserMessage(messages)).includes(
      QUICK_GUIDE_TOKEN,
    );
    const quickByHeuristic =
      !looksLikeStructuredPlanInput(lastUser) &&
      isQuickSuggestionIntent(lastUser);
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

    let content = completion.choices[0].message.content;

    // if see return "suggested_hotels" in the content, call getHotelSuggestionsForDestination and append results to the content before returning
    const hotelPayload = extractSuggestedHotelsPayload(content);
    if (hotelPayload) {
      console.log("AI requested hotel suggestions");

      const hotelSuggestions =
        await getHotelSuggestionsForDestination(hotelPayload);
      log("Hotel suggestions:", hotelSuggestions);
      const finalCompletion = await openai.chat.completions.create({
        model: "gpt-4o-mini",

        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },

          ...safeMessages,

          {
            role: "assistant",
            content,
          },

          {
            role: "user",
            content: `
          Here are hotel suggestions:

          ${JSON.stringify(hotelSuggestions, null, 2)}

          Now generate the FINAL COMPLETE trip plan JSON.

          Requirements:
          - Use the hotels above
          - Put hotels into "trip_plan.hotels"
          - Generate complete itinerary
          - Return valid JSON only
          `,
          },
        ],

        temperature: 0.6,
      });

      content = finalCompletion.choices[0].message.content;
    }

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

function looksLikeHotelIntent(value) {
  const text = normalize(value);
  if (!text) return false;
  const keywords = [
    "hotel",
    "khach san",
    "resort",
    "villa",
    "noi o",
    "luu tru",
    "booking",
    "stay",
    "where to stay",
    "accommodation",
    "recommend hotel",
    "hotel recommendation",
  ];
  return keywords.some((k) => text.includes(k));
}

function extractSuggestedHotelsPayload(content) {
  try {
    const rawJson = extractJsonFromText(content);

    if (!rawJson) {
      return null;
    }

    const parsed = JSON.parse(rawJson);

    console.log(parsed);

    if (!parsed?.suggested_hotels) {
      return null;
    }

    return parsed.suggested_hotels;
  } catch (err) {
    console.error("extractSuggestedHotelsPayload Error:", err.message);

    return null;
  }
}

/**
 * extract destination/location
 * from user message
 */
function extractDestination(value) {
  const text = String(value || "");

  /**
   * Vietnamese + English patterns
   */
  const patterns = [
    /tai\s+([^\n,.!?]+)/i,
    /o\s+([^\n,.!?]+)/i,
    /di\s+([^\n,.!?]+)/i,
    /den\s+([^\n,.!?]+)/i,

    /in\s+([^\n,.!?]+)/i,
    /at\s+([^\n,.!?]+)/i,
    /near\s+([^\n,.!?]+)/i,

    /hotel\s+(?:tai|o|in)\s+([^\n,.!?]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return match[1].trim().replace(/[?.!,]/g, "");
    }
  }

  /**
   * fallback city detection
   */
  const cities = [
    "ha noi",
    "hanoi",
    "ho chi minh",
    "sai gon",
    "da nang",
    "nha trang",
    "da lat",
    "hue",
    "quy nhon",
    "phu quoc",
    "tokyo",
    "osaka",
    "bangkok",
    "singapore",
    "bali",
    "paris",
    "london",
  ];

  const normalized = normalize(text);

  const found = cities.find((city) => normalized.includes(city));

  return found || null;
}
// Example usage:
// {
//     "countryCode": "VN",
//     "cityName": "Ho Chi Minh City",
//     "checkin": "2026-07-01",
//     "checkout": "2026-07-03",
//     "currency": "VND",
//     "guestNationality": "VN",
//     "occupancies": [{ "adults": 2 , "children": [0]}],
//     "timeout": 8,
//     "limit": 200,
//     "maxRatesPerHotel": 1,
//     "includeHotelData": true
//   }
async function getHotelSuggestionsForDestination(payloadContent) {
  try {
    const payload =
      typeof payloadContent === "string"
        ? JSON.parse(payloadContent)
        : payloadContent;

    const hotels = await searchHotelsByArea({
      countryCode: payload.countryCode,

      cityName: payload.cityName,

      limit: payload.limit || 20,

      offset: payload.offset || 0,
    });

    return hotels;
  } catch (error) {
    console.error("getHotelSuggestionsForDestination Error:", error.message);

    return {
      success: false,
      data: [],
    };
  }
}

module.exports = {
  generateTravelResponse,
  // generateTripPlanJson,
};
