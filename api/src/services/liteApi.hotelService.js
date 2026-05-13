require("dotenv").config();

const axios = require("axios");

const LITE_API_BASE_URL = "https://api.liteapi.travel/v3.0";

const liteApi = axios.create({
  baseURL: LITE_API_BASE_URL,

  headers: {
    "X-API-Key": process.env.LITEAPI_KEY,
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

/**
 * normalize
 */
function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * resolve city
 */
async function resolveCityCodeByName(destination) {
  try {
    const response = await liteApi.get("/data/cities", {
      params: {
        query: destination,
      },
    });

    const cities = response.data?.data || [];

    if (!cities.length) {
      return null;
    }

    const target = normalize(destination);

    const bestMatch =
      cities.find((city) => normalize(city.name).includes(target)) || cities[0];

    return {
      cityName: bestMatch.name,
      countryCode: bestMatch.countryCode,
      cityCode: bestMatch.cityCode || bestMatch.code || null,
    };
  } catch (error) {
    console.error(
      "resolveCityCodeByName Error:",
      error.response?.data || error.message,
    );

    return null;
  }
}

/**
 * SEARCH HOTELS
 * using GET /data/hotels
 */
async function searchHotelsByArea({
  countryCode,
  cityName,
  limit = 50,
  offset = 0,
}) {
  try {
    const response = await liteApi.get("/data/hotels", {
      params: {
        countryCode,
        cityName,
        limit,
        offset,
      },
    });

    const hotels = response.data?.data || [];

    /**
     * format data
     */
    const formattedHotels = hotels.map((hotel) => {
      const images = hotel.images || hotel.photos || hotel.gallery || [];

      return {
        id: hotel.hotelId || hotel.id,

        name: hotel.name || "",

        description: hotel.description || "",

        address: hotel.address || "",

        city: hotel.cityName || cityName,

        country: hotel.countryCode || countryCode,

        latitude: hotel.latitude || null,

        longitude: hotel.longitude || null,

        stars: hotel.starRating || hotel.stars || 0,

        amenities: hotel.amenities || [],

        thumbnail:
          hotel.main_photo || hotel.thumbnail || images?.[0]?.url || null,

        images: images.map((img) => ({
          url: img.url || img.image || img.link,

          caption: img.caption || "",
        })),
      };
    });

    return {
      success: true,
      total: formattedHotels.length,
      data: formattedHotels,
    };
  } catch (error) {
    console.error(
      "searchHotelsByArea Error:",
      error.response?.data || error.message,
    );

    throw new Error(
      error.response?.data?.error?.message || "Cannot fetch hotels",
    );
  }
}

module.exports = {
  searchHotelsByArea,
  resolveCityCodeByName,
};
