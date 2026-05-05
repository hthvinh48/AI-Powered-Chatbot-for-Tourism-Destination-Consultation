const openai = require("../config/openai");

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

const PROMPT = `You are an AI Trip Planner Agent. Your goal is to help the user plan a trip by asking one relevant trip-related question at a time.

Only ask questions about the following details, in order, and wait for the user's answer before asking the next:

Only ask questions about the following details, in order, and wait for the user's answer before asking the next:

Starting location (source)
Destination city or country
Group size (Solo, Couple, Family, Friends)
Budget 
Trip duration 
Travel interests (e.g., adventure, sightseeing, cultural, food, nightlife, relaxation)
Special requirements or preferences (if any)

Generate a travel plan given the input details.
- Provide a list of places to visit (top-level places_to_visit).
- Provide an array of hotel options (size).
- Provide a day-by-day itinerary with multiple activities each day (at least 3 activities per day if duration >= 2 days).
- Include estimated costs:
  - trip_plan.total_estimated_cost = total for the whole trip (in the currency you choose).
  - itinerary[].estimated_cost = per-day estimate (include accommodation + food + transport + tickets).
- Use realistic-sounding information, but if you are unsure, use placeholders.
- All image URLs must be valid-looking https URLs (placeholders allowed).
- All geo coordinates must be numbers.
- Output MUST match the schema exactly (field names/types).
- Do not include any extra keys.

Do not ask multiple questions at once, and never ask irrelevant questions.
If any answer is missing or unclear, politely ask the user to clarify before proceeding.
Always maintain a conversational, interactive style while asking questions.

Along with response also send which ui component to display for generative UI for example budget/groupSize/tripDuration/final, where Final means generating or showing final plan.

Use vietnamese when receive vietnamese, use english when receive english. Always respond in the same language as the input.
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

async function generateTravelResponse(messages) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: PROMPT }, ...messages],
      temperature: 0.7,
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
- Use realistic-sounding information, but if you are unsure, use placeholders.
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
          content: `Return Vietnamese-friendly "resp" like: "Cảm ơn bạn đã cung cấp đầy đủ thông tin! Dưới đây là kế hoạch chuyến đi của bạn." Then return the plan.\n\nInput:\n${JSON.stringify(
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
