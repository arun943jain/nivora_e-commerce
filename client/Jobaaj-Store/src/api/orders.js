import { ApiError, apiRequest } from "./client.js";

const invalidOrder = () =>
  new ApiError("The order service returned an invalid response.", {
    status: 200,
  });

const expectOrder = (payload) => {
  const order = payload?.data?.order;

  if (!order || !order.id || !Array.isArray(order.items)) {
    throw invalidOrder();
  }

  return order;
};

export const createOrder = async ({
  shippingAddress,
  phone,
  notes = "",
  couponCode = "",
  paymentMethod = "Cash on delivery",
}) =>
  expectOrder(
    await apiRequest("/orders", {
      method: "POST",
      body: {
        shippingAddress,
        phone,
        notes,
        couponCode,
        paymentMethod,
      },
    }),
  );

export const fetchOrders = async ({ signal } = {}) => {
  const payload = await apiRequest("/orders", { signal });
  const orders = payload?.data?.orders;

  if (!Array.isArray(orders)) {
    throw new ApiError("The order service returned an invalid response.", {
      status: 200,
    });
  }

  return orders;
};

export const fetchOrderById = async (orderId, { signal } = {}) => {
  const id = String(orderId || "").trim();

  if (!id) {
    throw new ApiError("Order not found.", { status: 404 });
  }

  return expectOrder(
    await apiRequest(`/orders/${encodeURIComponent(id)}`, { signal }),
  );
};
