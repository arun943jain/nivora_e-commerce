import {
  PAYMENT_METHODS,
  parseCheckoutInput,
} from "../services/checkoutService.js";
import {
  handleRazorpayWebhook,
  retryRazorpayCheckout,
  startRazorpayCheckout,
  verifyRazorpayPayment,
} from "../services/paymentService.js";
import { serializeOrder } from "../utils/serializers.js";

export const createRazorpayCheckout = async (req, res) => {
  const input = parseCheckoutInput(req.body, {
    allowedPaymentMethods: [PAYMENT_METHODS.RAZORPAY],
  });
  const { order, payment } = await startRazorpayCheckout({
    user: req.user,
    input,
  });

  res.status(201).json({
    success: true,
    data: {
      order: serializeOrder(order),
      payment,
    },
  });
};

export const retryRazorpayCheckoutHandler = async (req, res) => {
  const { order, payment } = await retryRazorpayCheckout({
    user: req.user,
    orderId: req.params.orderId,
  });

  res.status(200).json({
    success: true,
    data: {
      order: serializeOrder(order),
      payment,
    },
  });
};

export const verifyRazorpayPaymentHandler = async (req, res) => {
  const result = await verifyRazorpayPayment({
    user: req.user,
    body: req.body,
  });

  res.status(200).json({
    success: true,
    data: {
      order: serializeOrder(result.order),
      verified: result.verified,
      message: result.message,
    },
  });
};

// Razorpay calls this endpoint server-to-server. Authentication is the HMAC
// signature over the exact raw body, so requireAuth must not run here.
export const razorpayWebhook = async (req, res) => {
  res.set("Cache-Control", "no-store");

  const result = await handleRazorpayWebhook({
    rawBody: req.body,
    signature: req.get("x-razorpay-signature"),
    eventId: req.get("x-razorpay-event-id"),
  });

  res.status(200).json({
    received: true,
    duplicate: result.duplicate,
    status: result.status,
  });
};
