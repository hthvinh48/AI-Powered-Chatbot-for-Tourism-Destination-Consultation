const express = require("express");
const router = express.Router();

const asyncHandle = require("../utils/asyncHandle");
const authController = require("../controllers/auth.controller");

router.post("/register", asyncHandle(authController.register));
router.post("/login", asyncHandle(authController.login));
router.post("/refresh", asyncHandle(authController.refreshToken));
router.post("/logout", asyncHandle(authController.logout));
router.post("/clerk/exchange", asyncHandle(authController.clerkExchange));
router.post("/forgot-password", asyncHandle(authController.forgotPassword));
router.post("/reset-password", asyncHandle(authController.resetPassword));

module.exports = router;
