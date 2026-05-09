const express = require("express");

const asyncHandle = require("../utils/asyncHandle");
const billingController = require("../controllers/billing.controller");
const { authMiddleware } = require("../middleware/auth.middleware");

const router = express.Router();

// VNPay return is a browser redirect callback and won't include Authorization.
// Keep it public and validate using VNPay signature + txnRef lookup.
router.get(
  "/membership/vnpay/return",
  asyncHandle(billingController.handleMembershipVnpayReturn),
);

router.use(authMiddleware);

router.get("/summary", asyncHandle(billingController.getSummary));
router.get("/membership", asyncHandle(billingController.getMembership));
router.post("/membership", asyncHandle(billingController.createMembership));
router.post("/membership/vnpay/create", asyncHandle(billingController.createMembershipVnpay));
router.get("/purchases", asyncHandle(billingController.listPurchases));
router.post("/purchases", asyncHandle(billingController.createPurchase));
router.delete("/purchases/:id", asyncHandle(billingController.deletePurchase));
router.get("/invoices", asyncHandle(billingController.listInvoices));
router.get("/invoices/:id", asyncHandle(billingController.getInvoice));

module.exports = router;
