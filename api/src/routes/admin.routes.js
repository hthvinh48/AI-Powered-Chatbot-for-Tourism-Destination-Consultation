const express = require("express");
const router = express.Router();

const asyncHandle = require("../utils/asyncHandle");
const adminController = require("../controllers/admin.controller");

const { authMiddleware, authorizeRoles } = require("../middleware/auth.middleware");

// All admin endpoints require ADMIN or SUPER_ADMIN role.
router.use(authMiddleware, authorizeRoles("ADMIN", "SUPER_ADMIN"));

// Accounts
router.get("/users", asyncHandle(adminController.listUsers));
router.get("/users/:id", asyncHandle(adminController.getUser));
router.post("/users", asyncHandle(adminController.createUser));
router.patch("/users/:id", asyncHandle(adminController.updateUser));
router.delete("/users/:id", asyncHandle(adminController.deleteUser));
router.post("/users/:id/ban", asyncHandle(adminController.banUser));
router.post("/users/:id/unban", asyncHandle(adminController.unbanUser));

// Stats
router.get("/stats/questions", asyncHandle(adminController.questionStats));
router.get("/stats/tokens", asyncHandle(adminController.tokenStats));

// Billing/token quota
const adminBillingController = require("../controllers/adminBilling.controller");
router.get("/billing/free-tokens", asyncHandle(adminBillingController.getFreeTokensSetting));
router.patch("/billing/free-tokens", asyncHandle(adminBillingController.updateFreeTokensSetting));
router.get("/billing/monthly", asyncHandle(adminBillingController.monthlyUserTokenStats));
router.get("/billing/invoices", asyncHandle(adminBillingController.listInvoices));

// Back-compat: previous path.
router.get("/admin/users", asyncHandle(adminController.listUsers));

module.exports = router;
