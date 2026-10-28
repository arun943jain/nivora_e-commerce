import crypto from "node:crypto";
import Razorpay from "razorpay";
import { env } from "../config/env.js";
import {
  badGateway,
  badRequest,
  serviceUnavailable,
} from "./httpError.js";

const GATEWAY_TIMEOUT_MS = 15000;

let client = null;

export const razorpayConfigError = () => {
  if (!env.razorpayConfigured) {
    return "Online payments are not configured.";
  }

  if (!env.razorpayTestMode) {
    return "This build accepts Razorpay test-mode keys only.";
  }

  return "";
};

const requireClient = () => {
  const message = razorpayConfigError();

  if (message) {
    throw serviceUnavailable(message);
  }

  if (!client) {
    client = new Razorpay({
      key_id: env.razorpayKeyId,
      key_secret: env.razorpayKeySecret,
    });
  }

  return client;
};

const withTimeout = async (operation, message) => {
  let timer;

  try {
    return await Promise.race([
      operation,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(badGateway(message)),
          GATEWAY_TIMEOUT_MS,
        );
        timer.unref?.();
      }),
    ]);
  } catch (error) {
    if (error?.message === message) throw error;

    throw badGateway(message);
  } finally {
    clearTimeout(timer);
  }
};

export const toPaise = (amount) => {
  const value = Number(amount);

  if (!Number.isFinite(value) || value < 0) {
    throw badRequest("The payment amount is invalid.");
  }

  const paise = Math.round(value * 100);

  if (!Number.isSafeInteger(paise)) {
    throw badRequest("The payment amount is invalid.");
  }

  return paise;
};

export const assertPayableAmount = (paise) => {
  if (!Number.isSafeInteger(paise) || paise < 100) {
    throw badRequest(
      "Online payment requires an order total of at least ₹1. Choose cash on delivery instead.",
    );
  }
};

export const createRazorpayOrder = async (order) => {
  const instance = requireClient();
  const amount = toPaise(order.total);
  assertPayableAmount(amount);

  return withTimeout(
    instance.orders.create({
      amount,
      currency: "INR",
      receipt: order.orderNumber,
      notes: {
        internalOrderId: String(order._id),
        orderNumber: order.orderNumber,
      },
    }),
    "The payment gateway could not create a payment. Please try again.",
  );
};

export const fetchRazorpayPayment = async (paymentId) => {
  const instance = requireClient();

  return withTimeout(
    instance.payments.fetch(paymentId),
    "The payment could not be confirmed with the gateway. Please try again.",
  );
};

export const captureRazorpayPayment = async (paymentId, amount, currency) => {
  const instance = requireClient();

  return withTimeout(
    instance.payments.capture(paymentId, amount, currency),
    "The payment could not be captured. Please try again.",
  );
};

export const fetchRazorpayOrder = async (orderId) => {
  const instance = requireClient();

  return withTimeout(
    instance.orders.fetch(orderId),
    "The gateway order status could not be checked.",
  );
};

export const fetchRazorpayOrderPayments = async (orderId) => {
  const instance = requireClient();

  return withTimeout(
    instance.orders.fetchPayments(orderId),
    "The gateway payments for this order could not be checked.",
  );
};

const safeEqual = (left, right) => {
  const a = Buffer.from(String(left || ""), "utf8");
  const b = Buffer.from(String(right || ""), "utf8");

  if (a.length === 0 || a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
};

export const paymentSignature = (razorpayOrderId, paymentId) =>
  crypto
    .createHmac("sha256", env.razorpayKeySecret)
    .update(`${razorpayOrderId}|${paymentId}`)
    .digest("hex");

export const verifyPaymentSignature = (
  razorpayOrderId,
  paymentId,
  signature,
) => {
  if (!env.razorpayKeySecret) return false;

  return safeEqual(paymentSignature(razorpayOrderId, paymentId), signature);
};

export const verifyWebhookSignature = (rawBody, signature) => {
  if (!env.razorpayWebhookConfigured) return false;

  const expected = crypto
    .createHmac("sha256", env.razorpayWebhookSecret)
    .update(rawBody)
    .digest("hex");

  return safeEqual(expected, signature);
};

export const publicRazorpayKeyId = () => {
  const message = razorpayConfigError();

  if (message) {
    throw serviceUnavailable(message);
  }

  return env.razorpayKeyId;
};
