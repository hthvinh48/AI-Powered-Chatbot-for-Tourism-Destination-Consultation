const axios = require("axios");

const BASE_URL = process.env.LITEAPI_BASE_URL;
const API_KEY = process.env.LITEAPI_KEY;

/**
 * Search hotels by city
 */
exports.searchHotels = async ({
  cityCode,
  checkIn,
  checkOut,
  adults = 2,
  children = 0,
  rooms = 1,
  currency = "USD",
  limit = 20,
  offset = 0,
}) => {
  try {
    const response = await axios.get(`${BASE_URL}/hotels/search`, {
      headers: {
        "X-API-Key": API_KEY,
        "Content-Type": "application/json",
      },
      params: {
        cityCode,
        checkIn,
        checkOut,
        adults,
        children,
        rooms,
        currency,
        limit,
        offset,
      },
    });

    return {
      success: true,
      total: response.data.total || 0,
      hotels: response.data.data || [],
    };
  } catch (error) {
    console.error(
      "LiteAPI Hotel Search Error:",
      error.response?.data || error.message,
    );

    return {
      success: false,
      message: error.response?.data?.message || "Failed to fetch hotels",
    };
  }
};
