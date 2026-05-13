function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = Number.parseFloat(String(value || "").trim());
  return Number.isFinite(n) ? n : null;
}

function toStringOrNull(value) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s ? s : null;
}

function sanitizeGeo(obj) {
  if (!isPlainObject(obj)) return null;
  const latitude = toNumber(obj.latitude);
  const longitude = toNumber(obj.longitude);
  if (latitude === null || longitude === null) return null;
  return { latitude, longitude };
}

function sanitizeHotel(hotel) {
  if (!isPlainObject(hotel)) return null;

  /**
   * support multiple schemas
   */
  const hotel_name = toStringOrNull(hotel.hotel_name || hotel.name);

  const hotel_address = toStringOrNull(hotel.hotel_address || hotel.address);

  const price_per_night = toStringOrNull(hotel.price_per_night || hotel.price);

  const hotel_image_url = toStringOrNull(
    hotel.hotel_image_url || hotel.image_url,
  );

  /**
   * support images gallery
   */
  const images = Array.isArray(hotel.images)
    ? hotel.images
        .map((img) => ({
          thumbnail: toStringOrNull(img.thumbnail) || "",

          original: toStringOrNull(img.original) || "",

          source: toStringOrNull(img.source) || "",
        }))
        .filter((img) => img.thumbnail || img.original)
    : [];

  /**
   * geo support
   */
  const geo_coordinates = sanitizeGeo(
    hotel.geo_coordinates || hotel.geo_cordinates,
  );

  const rating = toNumber(hotel.rating);

  const description = toStringOrNull(hotel.description);

  /**
   * IMPORTANT:
   * only require hotel_name
   */
  if (!hotel_name) return null;

  return {
    hotel_name,

    hotel_address,

    price_per_night,

    hotel_image_url,

    images,

    geo_coordinates,

    rating: rating === null ? null : rating,

    description,
  };
}

function sanitizeActivity(activity) {
  if (!isPlainObject(activity)) return null;
  const place_name = toStringOrNull(activity.place_name);
  const place_details = toStringOrNull(activity.place_details);
  const place_image_url = toStringOrNull(activity.place_image_url);
  const geo_coordinates = sanitizeGeo(activity.geo_coordinates);
  const place_address = toStringOrNull(activity.place_address);
  const ticket_pricing = toStringOrNull(activity.ticket_pricing);
  const time_travel_each_location = toStringOrNull(
    activity.time_travel_each_location,
  );
  const best_time_to_visit = toStringOrNull(activity.best_time_to_visit);

  if (!place_name) return null;

  return {
    place_name,
    place_details,
    place_image_url,
    geo_coordinates,
    place_address,
    ticket_pricing,
    time_travel_each_location,
    best_time_to_visit,
  };
}

function sanitizePlace(place) {
  if (!isPlainObject(place)) return null;

  const place_name = toStringOrNull(place.place_name || place.name);

  const place_address = toStringOrNull(place.place_address || place.address);

  const place_details = toStringOrNull(
    place.place_details || place.description,
  );

  const place_image_url = toStringOrNull(
    place.place_image_url || place.image_url,
  );

  const images = Array.isArray(place.images)
    ? place.images
        .map((img) => ({
          thumbnail: toStringOrNull(img.thumbnail) || "",

          original: toStringOrNull(img.original) || "",

          source: toStringOrNull(img.source) || "",
        }))
        .filter((img) => img.thumbnail || img.original)
    : [];

  const geo_coordinates = sanitizeGeo(
    place.geo_coordinates || place.geo_cordinates,
  );

  if (!place_name) return null;

  return {
    place_name,

    place_address,

    place_details,

    place_image_url,

    images,

    geo_coordinates,
  };
}

function sanitizeItineraryDay(dayObj) {
  if (!isPlainObject(dayObj)) return null;
  const day = toNumber(dayObj.day);
  const day_plan = toStringOrNull(dayObj.day_plan);
  const best_time_to_visit_day = toStringOrNull(dayObj.best_time_to_visit_day);
  const estimated_cost = toStringOrNull(dayObj.estimated_cost);
  const activitiesRaw = Array.isArray(dayObj.activities)
    ? dayObj.activities
    : [];
  const activities = activitiesRaw.map(sanitizeActivity).filter(Boolean);

  if (day === null) return null;

  return {
    day: Math.trunc(day),
    day_plan,
    best_time_to_visit_day,
    estimated_cost,
    activities,
  };
}

function sanitizeTripPlanPayload(payload) {
  if (!isPlainObject(payload)) return null;
  const root =
    payload.trip_plan && isPlainObject(payload.trip_plan)
      ? payload.trip_plan
      : null;
  if (!root) return null;

  const destination = toStringOrNull(root.destination);
  const duration = toStringOrNull(root.duration);
  const origin = toStringOrNull(root.origin);
  const budget = toStringOrNull(root.budget);
  const group_size = toStringOrNull(root.group_size);
  const currency = toStringOrNull(root.currency);
  const total_estimated_cost = toStringOrNull(root.total_estimated_cost);

  const hotelsRaw = Array.isArray(root.hotels) ? root.hotels : [];
  const placesRaw = Array.isArray(root.places_to_visit)
    ? root.places_to_visit
    : [];
  const itineraryRaw = Array.isArray(root.itinerary) ? root.itinerary : [];

  const hotels = hotelsRaw.map(sanitizeHotel).filter(Boolean);
  const places_to_visit = placesRaw.map(sanitizePlace).filter(Boolean);
  const itinerary = itineraryRaw.map(sanitizeItineraryDay).filter(Boolean);

  if (!destination || !duration || !origin) return null;

  return {
    trip_plan: {
      destination,
      duration,
      origin,
      budget,
      group_size,
      currency,
      total_estimated_cost,
      hotels,
      places_to_visit,
      itinerary,
    },
  };
}

function parseBudgetNumber(budgetString) {
  if (!budgetString) return null;
  const match = String(budgetString)
    .replace(/,/g, "")
    .match(/(\d+(\.\d+)?)/);
  if (!match) return null;
  const n = Number.parseFloat(match[1]);
  return Number.isFinite(n) ? n : null;
}

module.exports = {
  sanitizeTripPlanPayload,
  parseBudgetNumber,
};
