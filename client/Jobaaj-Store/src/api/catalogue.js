import { ApiError, apiRequest } from "./client.js";

const appendParam = (params, name, value) => {
  if (value === undefined || value === null || value === "") return;

  params.set(name, String(value));
};

const expectData = (payload, message) => {
  if (!payload.data || typeof payload.data !== "object") {
    throw new ApiError(message, { status: 200 });
  }

  return payload.data;
};

export const fetchCategories = async ({ signal } = {}) => {
  const payload = await apiRequest("/categories", { signal });
  const data = expectData(
    payload,
    "The catalogue service returned an invalid category response.",
  );

  if (!Array.isArray(data.categories)) {
    throw new ApiError(
      "The catalogue service returned an invalid category response.",
      { status: 200 },
    );
  }

  return data.categories;
};

export const fetchProducts = async ({
  page = 1,
  limit = 24,
  search = "",
  category = "",
  minPrice = 0,
  maxPrice,
  sort = "featured",
  featured,
  bestseller,
  signal,
} = {}) => {
  const params = new URLSearchParams();
  appendParam(params, "page", page);
  appendParam(params, "limit", limit);
  appendParam(params, "search", search.trim());
  appendParam(params, "category", category);
  appendParam(params, "minPrice", minPrice > 0 ? minPrice : "");
  appendParam(params, "maxPrice", maxPrice);
  appendParam(params, "sort", sort);
  appendParam(params, "featured", featured);
  appendParam(params, "bestseller", bestseller);

  const payload = await apiRequest(`/products?${params.toString()}`, {
    signal,
  });
  const data = expectData(
    payload,
    "The catalogue service returned an invalid product response.",
  );

  if (!Array.isArray(data.products) || !data.pagination) {
    throw new ApiError(
      "The catalogue service returned an invalid product response.",
      { status: 200 },
    );
  }

  return {
    products: data.products,
    pagination: data.pagination,
  };
};

export const fetchProductBySlug = async (slug, { signal } = {}) => {
  const encodedSlug = encodeURIComponent(String(slug || "").trim());

  if (!encodedSlug) {
    throw new ApiError("Product not found.", { status: 404 });
  }

  const payload = await apiRequest(`/products/${encodedSlug}`, { signal });
  const data = expectData(
    payload,
    "The catalogue service returned an invalid product response.",
  );

  if (!data.product || typeof data.product !== "object") {
    throw new ApiError(
      "The catalogue service returned an invalid product response.",
      { status: 200 },
    );
  }

  return data.product;
};
