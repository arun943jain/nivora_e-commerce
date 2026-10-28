import { ApiError, apiRequest } from "./client.js";

const invalidAdminResponse = (message) =>
  new ApiError(message, { status: 200 });

const buildQuery = (params) => {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });

  const query = search.toString();
  return query ? `?${query}` : "";
};

const expectList = (payload, key, label) => {
  const items = payload?.data?.[key];

  if (!Array.isArray(items)) {
    throw invalidAdminResponse(`The admin ${label} response was invalid.`);
  }

  return {
    items,
    total: Number(payload?.data?.total ?? items.length),
  };
};

const expectRecord = (payload, key, label) => {
  const record = payload?.data?.[key];

  if (!record || typeof record !== "object") {
    throw invalidAdminResponse(`The admin ${label} response was invalid.`);
  }

  return record;
};

export const fetchAdminProducts = async ({
  search = "",
  status = "",
  sort = "",
  direction = "",
  signal,
} = {}) =>
  expectList(
    await apiRequest(
      `/admin/products${buildQuery({ search, status, sort, direction })}`,
      { signal },
    ),
    "products",
    "product list",
  );

export const createAdminProduct = async (payload) =>
  expectRecord(
    await apiRequest("/admin/products", { method: "POST", body: payload }),
    "product",
    "product",
  );

export const updateAdminProduct = async (id, payload) =>
  expectRecord(
    await apiRequest(`/admin/products/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: payload,
    }),
    "product",
    "product",
  );

export const deactivateAdminProduct = async (id) =>
  expectRecord(
    await apiRequest(`/admin/products/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
    "product",
    "product",
  );

export const fetchAdminOrders = async ({
  search = "",
  status = "",
  sort = "",
  direction = "",
  signal,
} = {}) =>
  expectList(
    await apiRequest(
      `/admin/orders${buildQuery({ search, status, sort, direction })}`,
      { signal },
    ),
    "orders",
    "order list",
  );

export const fetchAdminOrder = async (id, { signal } = {}) =>
  expectRecord(
    await apiRequest(`/admin/orders/${encodeURIComponent(id)}`, { signal }),
    "order",
    "order",
  );

export const updateAdminOrderStatus = async (id, status) =>
  expectRecord(
    await apiRequest(`/admin/orders/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: { status },
    }),
    "order",
    "order",
  );

export const fetchAdminUsers = async ({
  search = "",
  status = "",
  sort = "",
  direction = "",
  signal,
} = {}) =>
  expectList(
    await apiRequest(
      `/admin/users${buildQuery({ search, status, sort, direction })}`,
      { signal },
    ),
    "users",
    "customer list",
  );

export const updateAdminUser = async (id, patch) =>
  expectRecord(
    await apiRequest(`/admin/users/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: patch,
    }),
    "user",
    "customer",
  );

export const fetchAdminCoupons = async ({
  search = "",
  status = "",
  sort = "",
  direction = "",
  signal,
} = {}) =>
  expectList(
    await apiRequest(
      `/admin/coupons${buildQuery({ search, status, sort, direction })}`,
      { signal },
    ),
    "coupons",
    "coupon list",
  );

export const createAdminCoupon = async (payload) =>
  expectRecord(
    await apiRequest("/admin/coupons", { method: "POST", body: payload }),
    "coupon",
    "coupon",
  );

export const updateAdminCoupon = async (id, payload) =>
  expectRecord(
    await apiRequest(`/admin/coupons/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: payload,
    }),
    "coupon",
    "coupon",
  );

export const deactivateAdminCoupon = async (id) =>
  expectRecord(
    await apiRequest(`/admin/coupons/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
    "coupon",
    "coupon",
  );

export const fetchAdminDashboard = async ({ range = "", signal } = {}) => {
  const payload = await apiRequest(
    `/admin/dashboard${buildQuery({ range })}`,
    { signal },
  );
  const summary = payload?.data?.summary;

  if (!summary || typeof summary !== "object") {
    throw invalidAdminResponse("The admin dashboard response was invalid.");
  }

  return summary;
};
