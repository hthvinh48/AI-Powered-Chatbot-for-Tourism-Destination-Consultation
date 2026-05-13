const axios = require("axios");

const API_KEY = process.env.SERPAPI_KEY;

const BASE_URL = "https://serpapi.com/search.json";

/**
 * Google Image Search
 */
async function searchImages(query, limit = 3) {
  try {
    const response = await axios.get(BASE_URL, {
      params: {
        engine: "google_images",

        q: query,

        hl: "vi",

        gl: "vn",

        safe: "active",

        api_key: API_KEY,
      },
    });

    const results = response.data?.images_results || [];

    const images = results.slice(0, limit).map((img) => ({
      title: img.title || "",

      thumbnail: img.thumbnail || "",

      original: img.original || "",

      source: img.source || "",

      link: img.link || "",
    }));

    return {
      success: true,
      images,
    };
  } catch (error) {
    console.error("searchImages Error:", error.response?.data || error.message);

    return {
      success: false,
      images: [],
    };
  }
}

module.exports = {
  searchImages,
};
