import { ApiError, apiRequest } from "./client.js";

const invalidCart = () =>
  new ApiError("The cart service returned an invalid response.", {
    status: 200,
  });

export const expectCart = (payload) => {
  const cart = payload?.data?.cart;

  if (!cart || !Array.isArray(cart.items)) {
    throw invalidCart();
  }

  return cart;
};

export const fetchCart = async ({ signal } = {}) =>
  expectCart(await apiRequest("/cart", { signal }));

export const addCartItem = async ({ productId, quantity = 1 }) =>
  expectCart(
    await apiRequest("/cart/items", {
      method: "POST",
      body: { productId, quantity },
    }),
  );

export const updateCartItem = async (productId, quantity) =>
  expectCart(
    await apiRequest(`/cart/items/${encodeURIComponent(productId)}`, {
      method: "PATCH",
      body: { quantity },
    }),
  );

export const removeCartItem = async (productId) =>
  expectCart(
    await apiRequest(`/cart/items/${encodeURIComponent(productId)}`, {
      method: "DELETE",
    }),
  );

export const clearServerCart = async () =>
  expectCart(await apiRequest("/cart", { method: "DELETE" }));

export const mergeCart = async (items, { signal } = {}) => {
  const payload = await apiRequest("/cart/merge", {
    method: "POST",
    body: { items },
    signal,
  });

  return {
    cart: expectCart(payload),
    issues: Array.isArray(payload?.data?.issues) ? payload.data.issues : [],
  };
};

export const quoteCart = async (couponCode) =>
  expectCart(
    await apiRequest("/cart/quote", {
      method: "POST",
      body: { couponCode },
    }),
  );
