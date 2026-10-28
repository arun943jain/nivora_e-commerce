import { badRequest } from "./httpError.js";

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 24;
export const MAX_PAGE = 10000;
export const MAX_LIMIT = 60;
export const MAX_SEARCH_LENGTH = 100;
export const MAX_CATEGORY_LENGTH = 80;
export const MAX_PRICE = 10000000;

export const SORT_OPTIONS = new Set([
  "featured",
  "price-low",
  "price-high",
  "rating",
  "newest",
]);

const readSingle = (value, name) => {
  if (value === undefined || value === null) return "";

  if (Array.isArray(value)) {
    throw badRequest(`${name} must be a single value.`);
  }

  if (typeof value !== "string") {
    throw badRequest(`${name} must be a string.`);
  }

  return value.trim();
};

const parseInteger = (value, name, fallback, min, max) => {
  const raw = readSingle(value, name);

  if (!raw) return fallback;

  if (!/^\d+$/.test(raw)) {
    throw badRequest(`${name} must be a whole number.`);
  }

  const number = Number(raw);

  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw badRequest(`${name} must be between ${min} and ${max}.`);
  }

  return number;
};

const parsePrice = (value, name, fallback) => {
  const raw = readSingle(value, name);

  if (!raw) return fallback;

  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) {
    throw badRequest(`${name} must be a non-negative number.`);
  }

  const number = Number(raw);

  if (!Number.isFinite(number) || number > MAX_PRICE) {
    throw badRequest(`${name} must not exceed ${MAX_PRICE}.`);
  }

  return number;
};

const parseBoolean = (value, name) => {
  const raw = readSingle(value, name);

  if (!raw) return undefined;

  if (raw === "true") return true;
  if (raw === "false") return false;

  throw badRequest(`${name} must be true or false.`);
};

export const parseCatalogueQuery = (query = {}) => {
  const page = parseInteger(
    query.page,
    "page",
    DEFAULT_PAGE,
    1,
    MAX_PAGE,
  );
  const limit = parseInteger(
    query.limit,
    "limit",
    DEFAULT_LIMIT,
    1,
    MAX_LIMIT,
  );
  const minPrice = parsePrice(query.minPrice, "minPrice", 0);
  const maxPrice = parsePrice(query.maxPrice, "maxPrice", null);

  if (maxPrice !== null && maxPrice < minPrice) {
    throw badRequest("maxPrice cannot be less than minPrice.");
  }

  const search = readSingle(query.search ?? query.q, "search")
    .replace(/\s+/g, " ")
    .slice(0, MAX_SEARCH_LENGTH + 1);

  if (search.length > MAX_SEARCH_LENGTH) {
    throw badRequest(
      `search cannot exceed ${MAX_SEARCH_LENGTH} characters.`,
    );
  }

  const category = readSingle(query.category, "category");

  if (category.length > MAX_CATEGORY_LENGTH) {
    throw badRequest(
      `category cannot exceed ${MAX_CATEGORY_LENGTH} characters.`,
    );
  }

  const requestedSort = readSingle(query.sort, "sort");
  const sort = requestedSort || "featured";

  if (!SORT_OPTIONS.has(sort)) {
    throw badRequest(
      `sort must be one of: ${[...SORT_OPTIONS].join(", ")}.`,
    );
  }

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    minPrice,
    maxPrice,
    search,
    category,
    sort,
    featured: parseBoolean(query.featured, "featured"),
    bestseller: parseBoolean(query.bestseller, "bestseller"),
  };
};

export const escapeRegExp = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
