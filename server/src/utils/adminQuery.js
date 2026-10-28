import { badRequest } from "./httpError.js";
import { escapeRegExp } from "./catalogueQuery.js";

export const hasField = (source, field) =>
  Object.prototype.hasOwnProperty.call(source || {}, field);

export const readText = (
  value,
  label,
  { required = false, max = 200, fallback = "" } = {},
) => {
  if (value === undefined || value === null) {
    if (required) {
      throw badRequest(`${label} is required.`);
    }

    return fallback;
  }

  if (typeof value !== "string") {
    throw badRequest(`${label} must be text.`);
  }

  const text = value.trim();

  if (required && !text) {
    throw badRequest(`${label} is required.`);
  }

  if (text.length > max) {
    throw badRequest(`${label} cannot exceed ${max} characters.`);
  }

  return text;
};

export const readNumber = (
  value,
  label,
  {
    required = false,
    min = 0,
    max = Number.MAX_SAFE_INTEGER,
    integer = false,
    fallback = 0,
    allowNull = false,
  } = {},
) => {
  if (value === undefined || value === null || value === "") {
    if (allowNull) return null;
    if (required) throw badRequest(`${label} is required.`);
    return fallback;
  }

  const number = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(number)) {
    throw badRequest(`${label} must be a number.`);
  }

  if (integer && !Number.isInteger(number)) {
    throw badRequest(`${label} must be a whole number.`);
  }

  if (number < min || number > max) {
    throw badRequest(`${label} must be between ${min} and ${max}.`);
  }

  return number;
};

export const readBoolean = (value, label, fallback = false) => {
  if (value === undefined || value === null) return fallback;

  if (typeof value !== "boolean") {
    throw badRequest(`${label} must be true or false.`);
  }

  return value;
};

export const readImageUrl = (value, label, { required = false } = {}) => {
  const text = readText(value, label, { required, max: 2048 });

  if (!text) return "";

  let parsed;

  try {
    parsed = new URL(text);
  } catch {
    throw badRequest(`${label} must be a valid URL.`);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw badRequest(`${label} must start with http:// or https://.`);
  }

  return text;
};

export const readDate = (value, label) => {
  if (value === undefined || value === null || value === "") return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw badRequest(`${label} must be a valid date.`);
  }

  return date;
};

export const readEnum = (
  value,
  label,
  allowed,
  { required = false, fallback = "" } = {},
) => {
  if (value === undefined || value === null || value === "") {
    if (required) throw badRequest(`${label} is required.`);
    return fallback;
  }

  if (typeof value !== "string") {
    throw badRequest(`${label} must be text.`);
  }

  const text = value.trim();
  const match = allowed.find(
    (option) => option.toLowerCase() === text.toLowerCase(),
  );

  if (!match) {
    throw badRequest(`${label} must be one of: ${allowed.join(", ")}.`);
  }

  return match;
};

export const searchPattern = (value) =>
  new RegExp(escapeRegExp(value), "i");

export const parseAdminListQuery = (
  query = {},
  { sortable, defaultSort, statuses = [] } = {},
) => {
  const search = readText(query.search, "search", { max: 100 });
  const requestedStatus = readText(query.status, "status", { max: 40 });
  let status = "";

  if (requestedStatus && requestedStatus.toLowerCase() !== "all") {
    const match = statuses.find(
      (option) => option.toLowerCase() === requestedStatus.toLowerCase(),
    );

    if (!match) {
      throw badRequest(`status must be one of: ${statuses.join(", ")}.`);
    }

    status = match;
  }

  const requestedSort = readText(query.sort, "sort", { max: 40 });
  const sortKey = requestedSort && sortable[requestedSort] ? requestedSort : "";
  const directionRaw = readText(query.direction, "direction", { max: 8 });

  if (directionRaw && !["asc", "desc"].includes(directionRaw.toLowerCase())) {
    throw badRequest("direction must be asc or desc.");
  }

  return {
    search,
    status,
    sort: sortable[sortKey || defaultSort],
    direction: directionRaw.toLowerCase() === "asc" ? 1 : -1,
  };
};
