const express = require("express");

const asyncHandle = require("../utils/asyncHandle");
const chatController = require("../controllers/chat.controller");
const { authMiddleware } = require("../middleware/auth.middleware");

const router = express.Router();

// All chat endpoints require login.
router.use(authMiddleware);

router.get("/", asyncHandle(chatController.listChats));
router.post("/", asyncHandle(chatController.createChat));
router.get("/:chatId", asyncHandle(chatController.getChat));
router.patch("/:chatId", asyncHandle(chatController.updateChat));
router.delete("/:chatId", asyncHandle(chatController.deleteChat));

router.get("/:chatId/messages", asyncHandle(chatController.listMessages));
router.post("/ask", asyncHandle(chatController.ask)); // body: { chatId?, message, title? }

// Trip plans (generated JSON -> saved into TripPlan/Destination)
router.get("/:chatId/trip-plans", asyncHandle(chatController.listTripPlans));
router.post("/:chatId/trip-plans/generate", asyncHandle(chatController.generateTripPlan));
router.post("/:chatId/trip-plans", asyncHandle(chatController.saveTripPlan));

module.exports = router;
