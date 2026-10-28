import { ApiError, apiRequest } from "./client.js";

const invalidPayment = () =>
  new ApiError("The payment service returned an invalid response.", {
    status: 200,
  });

const expectOrder = (payload) => {
  const order = payload?.data?.order;

  if (!order || !order.id || !Array.isArray(order.items)) {
    throw invalidPayment();
  }

  return order;
};

const expectSession = (payload) => {
  const order = expectOrder(payload);
  const payment = payload?.data?.payment;

  // The server sends the public key id only. The key secret and webhook secret
  // never leave the API.
  if (
    !payment ||
    typeof payment.keyId !== "string" ||
    !payment.keyId ||
    typeof payment.orderId !== "string" ||
    !payment.orderId ||
    !Number.isInteger(payment.amount) ||
    payment.amount < 100 ||
    payment.currency !== "INR"
  ) {
    throw invalidPayment();
  }

  return {
    order,
    payment: {
      keyId: payment.keyId,
      orderId: payment.orderId,
      internalOrderId: String(payment.internalOrderId || order.id),
      amount: payment.amount,
      currency: payment.currency,
      name: payment.name || "Nivora",
      description: payment.description || `Order ${order.id}`,
      prefill: payment.prefill || {},
    },
  };
};

const checkoutBody = ({
  shippingAddress,
  phone,
  notes = "",
  couponCode = "",
}) => ({
  shippingAddress,
  phone,
  notes,
  couponCode,
  paymentMethod: "Razorpay",
});

export const createRazorpayCheckout = async (details) =>
  expectSession(
    await apiRequest("/payments/razorpay/checkout", {
      method: "POST",
      body: checkoutBody(details),
    }),
  );

export const retryRazorpayCheckout = async (orderId) => {
  const id = String(orderId || "").trim();

  if (!id) {
    throw new ApiError("Order not found.", { status: 404 });
  }

  return expectSession(
    await apiRequest(
      `/payments/razorpay/orders/${encodeURIComponent(id)}/retry`,
      { method: "POST", body: {} },
    ),
  );
};

export const verifyRazorpayPayment = async (response) => {
  const payload = await apiRequest("/payments/razorpay/verify", {
    method: "POST",
    body: {
      razorpay_order_id: response?.razorpay_order_id,
      razorpay_payment_id: response?.razorpay_payment_id,
      razorpay_signature: response?.razorpay_signature,
    },
  });
  const order = expectOrder(payload);

  if (typeof payload?.data?.verified !== "boolean") {
    throw invalidPayment();
  }

  return {
    order,
    verified: payload.data.verified,
    message: payload?.data?.message || "",
  };
};
