import { Router } from "express";
import {
  createRazorpayCheckout,
  retryRazorpayCheckoutHandler,
  verifyRazorpayPaymentHandler,
} from "../controllers/paymentController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
router.use(requireAuth);

router.post("/razorpay/checkout", createRazorpayCheckout);
router.post("/razorpay/orders/:orderId/retry", retryRazorpayCheckoutHandler);
router.post("/razorpay/verify", verifyRazorpayPaymentHandler);

export default router;
