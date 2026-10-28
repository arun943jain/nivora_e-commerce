import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

const envFile = fileURLToPath(new URL("../../.env", import.meta.url));
dotenv.config({ path: envFile, quiet: true });

const SUPPORTED_ENVIRONMENTS = new Set([
  "development",
  "test",
  "production",
]);

const nodeEnv = (process.env.NODE_ENV || "development").trim().toLowerCase();

if (!SUPPORTED_ENVIRONMENTS.has(nodeEnv)) {
  throw new Error(
    "NODE_ENV must be one of: development, test, production.",
  );
}

const isProduction = nodeEnv === "production";

const parsePort = (value) => {
  const raw = String(value || "5000").trim();

  if (!/^\d+$/.test(raw)) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }

  const port = Number(raw);
  if (port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }

  return port;
};

const parseClientOrigin = (value) => {
  const raw = String(value || "").trim();

  if (!raw) {
    if (isProduction) {
      throw new Error("CLIENT_ORIGIN is required in production.");
    }
    return "http://localhost:5173";
  }

  if (raw === "*") {
    throw new Error("CLIENT_ORIGIN must be one explicit origin, not '*'.");
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("CLIENT_ORIGIN must be a valid http(s) origin.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("CLIENT_ORIGIN must use http or https.");
  }

  return url.origin;
};

const parseCookieSameSite = (value) => {
  const raw = String(value || "lax").trim().toLowerCase();

  if (!["lax", "strict", "none"].includes(raw)) {
    throw new Error("COOKIE_SAME_SITE must be lax, strict or none.");
  }

  return raw;
};

const mongodbUri = String(process.env.MONGODB_URI || "").trim();
const jwtSecret = String(process.env.JWT_SECRET || "").trim();
const razorpayKeyId = String(process.env.RAZORPAY_KEY_ID || "").trim();
const razorpayKeySecret = String(process.env.RAZORPAY_KEY_SECRET || "").trim();
const razorpayWebhookSecret = String(
  process.env.RAZORPAY_WEBHOOK_SECRET || "",
).trim();

const razorpayConfigured = Boolean(
  razorpayKeyId.length > 0 && razorpayKeySecret.length > 0,
);
// This phase ships test-mode integration only. Live keys are rejected until
// the deployment phase explicitly enables them.
const razorpayTestMode = razorpayKeyId.startsWith("rzp_test_");

if (isProduction) {
  if (!mongodbUri) {
    throw new Error("MONGODB_URI is required in production.");
  }
  if (jwtSecret.length < 32) {
    throw new Error(
      "JWT_SECRET must be at least 32 characters in production.",
    );
  }
}

export const env = Object.freeze({
  nodeEnv,
  isProduction,
  port: parsePort(process.env.PORT),
  mongodbUri,
  clientOrigin: parseClientOrigin(process.env.CLIENT_ORIGIN),
  cookieSameSite: parseCookieSameSite(process.env.COOKIE_SAME_SITE),
  jwtSecret,
  jwtExpiresIn: String(process.env.JWT_EXPIRES_IN || "7d").trim(),
  authConfigured: jwtSecret.length >= 32,
  razorpayKeyId,
  razorpayKeySecret,
  razorpayWebhookSecret,
  razorpayConfigured,
  razorpayTestMode,
  razorpayEnabled: razorpayConfigured && razorpayTestMode,
  razorpayWebhookConfigured: razorpayWebhookSecret.length > 0,
});
