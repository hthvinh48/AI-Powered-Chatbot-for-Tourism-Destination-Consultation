// yahooService.js
const axios = require("axios");

const API_KEY = process.env.SERPAPI_KEY; // thay bằng API key của bạn
const BASE_URL = "https://serpapi.com/search";

async function yahooSearch(query) {
  try {
    const response = await axios.get(BASE_URL, {
      params: {
        engine: "yahoo_images",
        p: query,
        api_key: API_KEY,
      },
    });

    return response.data;
  } catch (error) {
    console.error("Yahoo Search API error:", error.message);
    throw error;
  }
}

module.exports = {
  yahooSearch,
  searchImages: yahooSearch,
};
