const express = require("express");

const asyncHandle = require("../utils/asyncHandle");
const tripPlanController = require("../controllers/tripPlan.controller");
const { authMiddleware } = require("../middleware/auth.middleware");

const router = express.Router();

router.use(authMiddleware);

router.get("/", asyncHandle(tripPlanController.listMyTripPlans));

module.exports = router;

