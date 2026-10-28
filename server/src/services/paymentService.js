import crypto from "node:crypto";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { Cart, Order, PaymentEvent } from "../models/index.js";
import {
  PAYMENT_METHODS,
  PAYMENT_RESERVATION_MS,
  StockUnavailableError,
  createReservedOrder,
  findExpiredRazorpayOrders,
  findOpenRazorpayReservation,
  reReserveOrderStock,
  releaseOrderReservation,
  runCheckoutTransaction,
} from "./checkoutService.js";
import {
  badGateway,
  badRequest,
  conflict,
  notFound,
  serviceUnavailable,
} from "../utils/httpError.js";
import {
  assertPayableAmount,
  captureRazorpayPayment,
  createRazorpayOrder,
  fetchRazorpayOrder,
  fetchRazorpayOrderPayments,
  fetchRazorpayPayment,
  publicRazorpayKeyId,
  toPaise,
  verifyPaymentSignature,
  verifyWebhookSignature,
} from "../utils/razorpay.js";

const PAYMENT_EVENT_STATUSES = new Set(["processed", "ignored"]);
const SETTLED_PAYMENT_STATUSES = new Set(["Paid", "Refunded"]);
const RESERVATION_ISSUE =
  "The payment window expired before payment was completed.";

const readPaymentText = (value, label, maxLength = 100) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw badRequest(`${label} is required.`);
  }

  const text = value.trim();

  if (text.length > maxLength) {
    throw badRequest(`${label} cannot exceed ${maxLength} characters.`);
  }

  return text;
};

const paymentDescription = (order) => `Order ${order.orderNumber}`;

const buildPaymentSession = (order) => {
  const amount = toPaise(order.total);
  assertPayableAmount(amount);

  return {
    keyId: publicRazorpayKeyId(),
    orderId: order.razorpay.orderId,
    internalOrderId: order.orderNumber,
    amount,
    currency: "INR",
    name: "Nivora",
    description: paymentDescription(order),
    prefill: {
      name: order.customer?.name || "",
      email: order.customer?.email || "",
      contact: order.customer?.phone || "",
    },
  };
};

const assertGatewayAmount = (order, gatewayOrder) => {
  const expected = toPaise(order.total);

  if (
    Number(gatewayOrder?.amount) !== expected ||
    String(gatewayOrder?.currency || "") !== "INR"
  ) {
    throw badGateway(
      "The payment gateway returned an unexpected amount. No payment was started.",
    );
  }
};

const attachGatewayOrder = async (order, gatewayOrder) => {
  const now = new Date();
  const updated = await Order.findOneAndUpdate(
    {
      _id: order._id,
      stockReserved: true,
      paymentStatus: { $in: ["Pending", "Failed"] },
    },
    {
      $set: {
        "razorpay.orderId": gatewayOrder.id,
        paymentStatus: "Pending",
        paymentExpiresAt: new Date(now.getTime() + PAYMENT_RESERVATION_MS),
        paymentIssue: "",
      },
      $push: {
        "razorpay.attempts": {
          orderId: gatewayOrder.id,
          status: "created",
          createdAt: now,
        },
      },
    },
    { new: true },
  );

  if (!updated) {
    throw conflict("This order can no longer accept an online payment.");
  }

  return updated;
};

export const startRazorpayCheckout = async ({ user, input }) => {
  publicRazorpayKeyId();

  const pending = await findOpenRazorpayReservation(user._id);

  if (pending) {
    throw conflict(
      `You already have an unfinished online payment for order ${pending.orderNumber}. Open that order to retry the payment, or wait for it to expire.`,
    );
  }

  const order = await createReservedOrder({
    userId: user._id,
    userEmail: user.email,
    input,
    paymentMethod: PAYMENT_METHODS.RAZORPAY,
    paymentExpiresAt: new Date(Date.now() + PAYMENT_RESERVATION_MS),
    clearCart: false,
  });

  try {
    const gatewayOrder = await createRazorpayOrder(order);
    assertGatewayAmount(order, gatewayOrder);
    const updated = await attachGatewayOrder(order, gatewayOrder);

    return { order: updated, payment: buildPaymentSession(updated) };
  } catch (error) {
    await releaseOrderReservation({
      orderId: order._id,
      paymentIssue: "The payment could not be started.",
    }).catch(() => {});

    throw error;
  }
};

export const retryRazorpayCheckout = async ({ user, orderId }) => {
  publicRazorpayKeyId();

  const id = String(orderId || "").trim();

  if (!id || id.length > 60) {
    throw notFound("Order not found.");
  }

  const filters = [{ orderNumber: id }];
  if (mongoose.isValidObjectId(id)) filters.push({ _id: id });

  const order = await Order.findOne({
    user: user._id,
    $or: filters,
  });

  if (!order) {
    throw notFound("Order not found.");
  }

  if (order.paymentMethod !== PAYMENT_METHODS.RAZORPAY) {
    throw badRequest("This order does not use online payment.");
  }

  if (order.paymentStatus === "Paid") {
    throw conflict("This order has already been paid.");
  }

  if (order.paymentStatus === "Refunded") {
    throw conflict("This order has been refunded.");
  }

  if (!order.stockReserved) {
    throw conflict(
      "The payment window for this order has closed. Start a new checkout.",
    );
  }

  if (order.paymentExpiresAt && order.paymentExpiresAt.getTime() <= Date.now()) {
    await releaseOrderReservation({
      orderId: order._id,
      paymentIssue: RESERVATION_ISSUE,
    });
    throw conflict(
      "The payment window for this order has expired. Start a new checkout.",
    );
  }

  // Reuse an open gateway order when possible. A Razorpay order can only be
  // paid once, so reusing it stops two browser tabs creating two live payments
  // for the same internal order.
  const openAttempt = [...(order.razorpay?.attempts || [])]
    .reverse()
    .find((attempt) => attempt.status === "created" && attempt.orderId);

  if (openAttempt) {
    const gatewayOrder = await fetchRazorpayOrder(openAttempt.orderId);

    if (gatewayOrder?.status === "paid") {
      throw conflict(
        "A payment for this order is already being confirmed. Check the order again in a moment.",
      );
    }

    assertGatewayAmount(order, gatewayOrder);

    const updated = await Order.findOneAndUpdate(
      {
        _id: order._id,
        stockReserved: true,
        paymentStatus: { $in: ["Pending", "Failed"] },
      },
      {
        $set: {
          "razorpay.orderId": openAttempt.orderId,
          paymentStatus: "Pending",
          paymentExpiresAt: new Date(Date.now() + PAYMENT_RESERVATION_MS),
          paymentIssue: "",
        },
      },
      { new: true },
    );

    if (!updated) {
      throw conflict("This order can no longer accept an online payment.");
    }

    return { order: updated, payment: buildPaymentSession(updated) };
  }

  const gatewayOrder = await createRazorpayOrder(order);
  assertGatewayAmount(order, gatewayOrder);
  const updated = await attachGatewayOrder(order, gatewayOrder);

  return { order: updated, payment: buildPaymentSession(updated) };
};

const removeOrderedCartItems = async (order, session) => {
  const cart = await Cart.findOne({ user: order.user }).session(session);

  if (!cart) return;

  const remaining = [];

  for (const item of cart.items) {
    const ordered = order.items.find(
      (orderItem) => String(orderItem.product) === String(item.product),
    );

    if (!ordered) {
      remaining.push(item);
      continue;
    }

    const quantity = item.quantity - ordered.quantity;

    if (quantity > 0) {
      remaining.push({
        product: item.product,
        productId: item.productId,
        quantity,
      });
    }
  }

  cart.items = remaining;
  await cart.save({ session });
};

const settleOnce = async ({
  orderId,
  razorpayOrderId,
  paymentId,
  forceCancel,
}) =>
  runCheckoutTransaction(async (session) => {
    const order = await Order.findById(orderId).session(session);

    if (!order) {
      throw notFound("Order not found.");
    }

    if (order.paymentStatus === "Paid") {
      if (
        order.razorpay?.paymentId &&
        order.razorpay.paymentId !== paymentId
      ) {
        throw conflict(
          "This order was already paid with a different payment.",
        );
      }

      return order;
    }

    if (order.paymentStatus === "Refunded") {
      return order;
    }

    if (!order.stockReserved) {
      if (forceCancel) {
        order.status = "Cancelled";
        order.paymentIssue =
          "Payment was captured after the stock reservation expired and the items are no longer available. A manual refund is required.";
      } else {
        await reReserveOrderStock(order, { session });
        order.stockReserved = true;
        order.stockReleasedAt = null;
        order.paymentExpiresAt = null;

        if (order.status === "Cancelled") {
          order.status = "Pending";
        }
      }
    } else if (order.status === "Cancelled") {
      order.status = "Pending";
    }

    order.paymentStatus = "Paid";
    order.paymentIssue = forceCancel ? order.paymentIssue : "";
    order.paymentExpiresAt = null;
    order.razorpay = order.razorpay || {};
    order.razorpay.attempts = order.razorpay.attempts || [];
    order.razorpay.paymentId = paymentId;
    order.razorpay.orderId = razorpayOrderId;

    const attempt = order.razorpay.attempts.find(
      (item) => item.orderId === razorpayOrderId,
    );

    if (attempt) {
      attempt.status = "paid";
      attempt.paymentId = paymentId;
      attempt.resolvedAt = new Date();
    } else {
      order.razorpay.attempts.push({
        orderId: razorpayOrderId,
        paymentId,
        status: "paid",
        createdAt: new Date(),
        resolvedAt: new Date(),
      });
    }

    await order.save({ session });
    await removeOrderedCartItems(order, session);

    return order;
  });

export const settleCapturedPayment = async ({
  orderId,
  razorpayOrderId,
  paymentId,
}) => {
  try {
    return await settleOnce({
      orderId,
      razorpayOrderId,
      paymentId,
      forceCancel: false,
    });
  } catch (error) {
    if (!(error instanceof StockUnavailableError)) {
      throw error;
    }

    // The customer's money was captured after the reservation expired and the
    // items are gone. Record the payment honestly without decrementing stock;
    // this order now requires a manual refund.
    return settleOnce({
      orderId,
      razorpayOrderId,
      paymentId,
      forceCancel: true,
    });
  }
};

const markPaymentFailed = async ({
  orderId,
  razorpayOrderId,
  paymentId,
  reason,
}) => {
  const detail = String(reason || "The payment attempt failed.").slice(0, 500);
  const now = new Date();
  const result = await Order.updateOne(
    {
      _id: orderId,
      paymentStatus: { $in: ["Pending", "Failed"] },
      "razorpay.attempts.orderId": razorpayOrderId,
    },
    {
      $set: {
        paymentStatus: "Failed",
        paymentIssue: detail,
        "razorpay.attempts.$.status": "failed",
        "razorpay.attempts.$.paymentId": paymentId || "",
        "razorpay.attempts.$.resolvedAt": now,
      },
    },
  );

  if (result.matchedCount === 0) {
    await Order.updateOne(
      { _id: orderId, paymentStatus: { $in: ["Pending", "Failed"] } },
      { $set: { paymentStatus: "Failed", paymentIssue: detail } },
    );
  }
};

const markPaymentIssue = async (orderId, detail) => {
  await Order.updateOne(
    { _id: orderId, paymentStatus: { $ne: "Paid" } },
    { $set: { paymentIssue: String(detail).slice(0, 500) } },
  ).catch(() => {});
};

const refreshOrder = async (orderId) => {
  const order = await Order.findById(orderId);

  if (!order) {
    throw notFound("Order not found.");
  }

  return order;
};

export const verifyRazorpayPayment = async ({ user, body }) => {
  publicRazorpayKeyId();

  const gatewayOrderId = readPaymentText(
    body?.razorpay_order_id,
    "Razorpay order ID",
  );
  const paymentId = readPaymentText(
    body?.razorpay_payment_id,
    "Razorpay payment ID",
  );
  const signature = readPaymentText(
    body?.razorpay_signature,
    "Razorpay signature",
    200,
  );

  const order = await Order.findOne({
    user: user._id,
    $or: [
      { "razorpay.orderId": gatewayOrderId },
      { "razorpay.attempts.orderId": gatewayOrderId },
    ],
  });

  if (!order) {
    throw notFound("No order matches this payment.");
  }

  if (order.paymentStatus === "Refunded") {
    return {
      order,
      verified: false,
      message: "This payment has already been refunded.",
    };
  }

  // The browser-supplied order id is only used to locate the order. The HMAC
  // is always calculated from the id stored on the internal order.
  const storedAttempt = (order.razorpay?.attempts || []).find(
    (attempt) => attempt.orderId === gatewayOrderId,
  );
  const storedOrderId =
    storedAttempt?.orderId || order.razorpay?.orderId || "";

  if (!storedOrderId || storedOrderId !== gatewayOrderId) {
    throw badRequest("This payment does not belong to your order.");
  }

  if (!verifyPaymentSignature(storedOrderId, paymentId, signature)) {
    throw badRequest("The payment signature could not be verified.");
  }

  const payment = await fetchRazorpayPayment(paymentId);

  if (payment?.order_id !== storedOrderId) {
    throw badRequest("This payment does not belong to your order.");
  }

  const expectedAmount = toPaise(order.total);

  if (
    Number(payment?.amount) !== expectedAmount ||
    String(payment?.currency || "") !== "INR"
  ) {
    await markPaymentIssue(
      order._id,
      "The paid amount did not match the order total.",
    );
    throw conflict(
      "The paid amount did not match this order. The order was not marked paid.",
    );
  }

  if (payment.status === "failed") {
    await markPaymentFailed({
      orderId: order._id,
      razorpayOrderId: storedOrderId,
      paymentId,
      reason: payment.error_description || "The payment failed.",
    });
    const failedOrder = await refreshOrder(order._id);

    return {
      order: failedOrder,
      verified: false,
      message:
        "The payment failed. Your bag is unchanged and you can try again.",
    };
  }

  if (payment.status === "refunded") {
    return {
      order: await refreshOrder(order._id),
      verified: false,
      message: "This payment has already been refunded.",
    };
  }

  let settledPayment = payment;

  if (payment.status === "authorized") {
    try {
      settledPayment = await captureRazorpayPayment(
        paymentId,
        expectedAmount,
        "INR",
      );
    } catch {
      settledPayment = await fetchRazorpayPayment(paymentId);
    }
  }

  if (
    settledPayment.status !== "captured" ||
    settledPayment.captured !== true
  ) {
    return {
      order: await refreshOrder(order._id),
      verified: false,
      message:
        settledPayment.status === "failed"
          ? "The payment failed. Your bag is unchanged and you can try again."
          : "The payment is still being confirmed. Do not pay again; check this order again shortly.",
    };
  }

  const paidOrder = await settleCapturedPayment({
    orderId: order._id,
    razorpayOrderId: storedOrderId,
    paymentId,
  });

  return {
    order: paidOrder,
    verified: true,
    message:
      paidOrder.status === "Cancelled"
        ? "Payment was received, but the items are no longer available. Our team will contact you about a refund."
        : "Payment received.",
  };
};

const findOrderForPayment = (payment) => {
  const gatewayOrderId = String(payment?.order_id || "").trim();

  if (!gatewayOrderId) return Promise.resolve(null);

  return Order.findOne({
    $or: [
      { "razorpay.orderId": gatewayOrderId },
      { "razorpay.attempts.orderId": gatewayOrderId },
    ],
  });
};

const processWebhookEvent = async (payload) => {
  const event = String(payload?.event || "").trim();
  const payment = payload?.payload?.payment?.entity || null;

  if (!payment) {
    return {
      status: "ignored",
      detail: "The event did not include a payment.",
      razorpayOrderId: "",
      paymentId: "",
    };
  }

  const razorpayOrderId = String(payment.order_id || "").trim();
  const paymentId = String(payment.id || "").trim();
  const order = await findOrderForPayment(payment);

  if (!order) {
    return {
      status: "ignored",
      detail: "No internal order matched the payment.",
      razorpayOrderId,
      paymentId,
    };
  }

  if (event === "payment.failed") {
    if (SETTLED_PAYMENT_STATUSES.has(order.paymentStatus)) {
      return {
        status: "ignored",
        detail: "A late failure event was ignored after settlement.",
        razorpayOrderId,
        paymentId,
      };
    }

    await markPaymentFailed({
      orderId: order._id,
      razorpayOrderId,
      paymentId,
      reason: payment.error_description || "The payment failed.",
    });

    return {
      status: "processed",
      detail: "Payment failure recorded.",
      razorpayOrderId,
      paymentId,
    };
  }

  if (event !== "payment.captured" && event !== "order.paid") {
    return {
      status: "ignored",
      detail: `Event ${event || "(unknown)"} is not handled.`,
      razorpayOrderId,
      paymentId,
    };
  }

  if (payment.status !== "captured" || payment.captured !== true) {
    return {
      status: "ignored",
      detail: "The payment is not captured yet.",
      razorpayOrderId,
      paymentId,
    };
  }

  if (
    Number(payment.amount) !== toPaise(order.total) ||
    String(payment.currency || "") !== "INR"
  ) {
    await markPaymentIssue(
      order._id,
      "A captured webhook amount did not match the order total.",
    );

    return {
      status: "ignored",
      detail: "The captured amount did not match the order.",
      razorpayOrderId,
      paymentId,
    };
  }

  if (SETTLED_PAYMENT_STATUSES.has(order.paymentStatus)) {
    return {
      status: "processed",
      detail: "The order was already settled.",
      razorpayOrderId,
      paymentId,
    };
  }

  await settleCapturedPayment({
    orderId: order._id,
    razorpayOrderId,
    paymentId,
  });

  return {
    status: "processed",
    detail: "Payment captured and order marked paid.",
    razorpayOrderId,
    paymentId,
  };
};

export const handleRazorpayWebhook = async ({
  rawBody,
  signature,
  eventId,
}) => {
  if (!env.razorpayWebhookConfigured) {
    throw serviceUnavailable("The payment webhook is not configured.");
  }

  if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) {
    throw badRequest("A raw webhook body is required.");
  }

  if (!verifyWebhookSignature(rawBody, signature)) {
    throw badRequest("Invalid webhook signature.");
  }

  let payload;

  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    throw badRequest("Invalid webhook payload.");
  }

  const resolvedEventId =
    String(eventId || "").trim() ||
    crypto.createHash("sha256").update(rawBody).digest("hex");
  const eventName = String(payload?.event || "").trim();
  const existing = await PaymentEvent.findOne({ eventId: resolvedEventId });

  if (
    existing &&
    PAYMENT_EVENT_STATUSES.has(existing.status)
  ) {
    return {
      duplicate: true,
      event: existing.event,
      status: existing.status,
    };
  }

  await PaymentEvent.updateOne(
    { eventId: resolvedEventId },
    {
      $setOnInsert: {
        eventId: resolvedEventId,
        event: eventName,
        status: "received",
      },
    },
    { upsert: true },
  );

  try {
    const result = await processWebhookEvent(payload);

    await PaymentEvent.updateOne(
      { eventId: resolvedEventId },
      {
        $set: {
          event: eventName,
          status: result.status,
          razorpayOrderId: result.razorpayOrderId || "",
          paymentId: result.paymentId || "",
          detail: result.detail || "",
        },
      },
    );

    return {
      duplicate: false,
      event: eventName,
      status: result.status,
    };
  } catch (error) {
    await PaymentEvent.updateOne(
      { eventId: resolvedEventId },
      {
        $set: {
          event: eventName,
          status: "failed",
          detail: String(error?.message || "Webhook processing failed.").slice(
            0,
            500,
          ),
        },
      },
    ).catch(() => {});

    throw error;
  }
};

export const releaseExpiredRazorpayOrders = async ({ limit = 10 } = {}) => {
  if (!env.razorpayEnabled) return 0;

  const orders = await findExpiredRazorpayOrders({ limit });
  let released = 0;

  for (const order of orders) {
    let gatewayIsBusy = false;

    for (const attempt of order.razorpay?.attempts || []) {
      try {
        const [gatewayOrder, gatewayPayments] = await Promise.all([
          fetchRazorpayOrder(attempt.orderId),
          fetchRazorpayOrderPayments(attempt.orderId),
        ]);
        const payments = Array.isArray(gatewayPayments?.items)
          ? gatewayPayments.items
          : [];
        const hasCapturedPayment = payments.some(
          (payment) =>
            payment?.status === "captured" || payment?.captured === true,
        );

        // A capture can land just before the expiration sweep sees it. Keep the
        // reservation when the gateway has any captured payment so a paid order
        // never loses its stock.
        if (gatewayOrder?.status === "paid" || hasCapturedPayment) {
          gatewayIsBusy = true;
          break;
        }
      } catch {
        // Fail closed. If the gateway cannot be checked, keep the stock held
        // and try again on the next sweep instead of risking a paid order
        // losing its reservation.
        gatewayIsBusy = true;
        break;
      }
    }

    if (gatewayIsBusy) continue;

    const expired = await releaseOrderReservation({
      orderId: order._id,
      paymentStatus: "Failed",
      paymentIssue: RESERVATION_ISSUE,
    });

    if (expired) released += 1;
  }

  return released;
};
