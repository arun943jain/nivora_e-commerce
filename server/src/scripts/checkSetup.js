import dotenv from "dotenv";
import mongoose from "mongoose";
import { fileURLToPath } from "node:url";

// Load the same file as src/config/env.js without importing that module, so
// incomplete settings can be reported instead of throwing at import time.
const envFile = fileURLToPath(new URL("../../.env", import.meta.url));
dotenv.config({ path: envFile, quiet: true });

const offline = process.argv.includes("--offline");
const read = (name) => String(process.env[name] || "").trim();
const report = (label, value) => console.log(`[setup] ${label}: ${value}`);

const nodeEnv = (read("NODE_ENV") || "development").toLowerCase();
const isProduction = nodeEnv === "production";
const mongodbUri = read("MONGODB_URI");
const jwtSecret = read("JWT_SECRET");
const clientOrigin = read("CLIENT_ORIGIN");
const cookieSameSite = (read("COOKIE_SAME_SITE") || "lax").toLowerCase();
const razorpayKeyId = read("RAZORPAY_KEY_ID");
const razorpayKeySecret = read("RAZORPAY_KEY_SECRET");
const razorpayWebhookSecret = read("RAZORPAY_WEBHOOK_SECRET");

const problems = [];
const warnings = [];
const placeholders = /<[^>]+>/;
const validSameSite = ["lax", "strict", "none"].includes(cookieSameSite);

// Values are deliberately never printed. Only presence and derived status are
// shown, so this command is safe to run in a terminal that may be recorded.
report(
  "NODE_ENV",
  isProduction
    ? "present (production mode)"
    : nodeEnv === "test"
      ? "present (test mode)"
      : "present (development mode)",
);
report("PORT", read("PORT") ? "present" : "default");

if (!mongodbUri) {
  report("MONGODB_URI", "missing");
  problems.push("MONGODB_URI is missing.");
} else if (placeholders.test(mongodbUri)) {
  report("MONGODB_URI", "present but still contains a placeholder");
  problems.push(
    "Replace the <db_username>/<db_password> placeholders in MONGODB_URI.",
  );
} else {
  report("MONGODB_URI", "present");
}

if (jwtSecret.length >= 32) {
  report("JWT_SECRET", "present (32+ characters)");
} else if (jwtSecret.length > 0) {
  report("JWT_SECRET", "present but shorter than 32 characters");
  problems.push("JWT_SECRET must be at least 32 characters.");
} else {
  report("JWT_SECRET", "missing");
  problems.push("JWT_SECRET is missing.");
}

if (clientOrigin) {
  let validOrigin = false;

  try {
    const parsed = new URL(clientOrigin);
    validOrigin =
      clientOrigin !== "*" && ["http:", "https:"].includes(parsed.protocol);
  } catch {
    validOrigin = false;
  }

  report(
    "CLIENT_ORIGIN",
    validOrigin ? "present (valid)" : "present (invalid)",
  );

  if (!validOrigin) {
    problems.push("CLIENT_ORIGIN must be one valid http(s) origin, not '*'.");
  }
} else {
  report("CLIENT_ORIGIN", "missing");
  if (isProduction) {
    problems.push("CLIENT_ORIGIN is required in production.");
  } else {
    warnings.push(
      "CLIENT_ORIGIN is unset; development defaults to http://localhost:5173.",
    );
  }
}

report(
  "COOKIE_SAME_SITE",
  validSameSite ? "present or default (valid)" : "invalid",
);
if (!validSameSite) {
  problems.push("COOKIE_SAME_SITE must be lax, strict or none.");
}

if (!razorpayKeyId) {
  report("RAZORPAY_KEY_ID", "missing (online payments disabled)");
} else if (!razorpayKeyId.startsWith("rzp_test_")) {
  report(
    "RAZORPAY_KEY_ID",
    "present but not a test key (online payments disabled)",
  );
  problems.push("This build accepts Razorpay test keys only (rzp_test_...).");
} else {
  report("RAZORPAY_KEY_ID", "present (test mode)");
}

report("RAZORPAY_KEY_SECRET", razorpayKeySecret ? "present" : "missing");
report(
  "RAZORPAY_WEBHOOK_SECRET",
  razorpayWebhookSecret
    ? "present"
    : "missing (webhook deliveries will be rejected)",
);

if (razorpayKeyId && !razorpayKeySecret) {
  problems.push("RAZORPAY_KEY_SECRET is missing while RAZORPAY_KEY_ID is set.");
} else if (!razorpayKeyId && razorpayKeySecret) {
  problems.push("RAZORPAY_KEY_ID is missing while RAZORPAY_KEY_SECRET is set.");
} else if (razorpayKeyId.startsWith("rzp_test_") && razorpayKeySecret) {
  report("Online payments", "ready (test mode)");
} else {
  report("Online payments", "disabled (cash on delivery still works)");
}

if (
  razorpayKeyId.startsWith("rzp_test_") &&
  razorpayKeySecret &&
  !razorpayWebhookSecret
) {
  warnings.push(
    "RAZORPAY_WEBHOOK_SECRET is missing; Razorpay webhook deliveries will be rejected.",
  );
}

const checkDatabase = async () => {
  if (offline) {
    report("MongoDB", "skipped (--offline)");
    return;
  }

  if (!mongodbUri || placeholders.test(mongodbUri)) {
    report("MongoDB", "skipped (MONGODB_URI missing or placeholder)");
    return;
  }

  try {
    await mongoose.connect(mongodbUri, { serverSelectionTimeoutMS: 5000 });
    report("MongoDB", "connected");

    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    const transactionsSupported =
      Boolean(hello.setName) || hello.msg === "isdbgrid";

    report(
      "Transactions",
      transactionsSupported
        ? "supported"
        : "NOT supported (standalone MongoDB; checkout will return 503)",
    );

    if (!transactionsSupported) {
      problems.push(
        "MongoDB must be a replica set or sharded cluster for checkout and payment reservations.",
      );
    }
  } catch {
    // Do not print the driver error: connection errors can include URI parts.
    report(
      "MongoDB",
      "connection failed (check the URI, database user, password encoding and network access)",
    );
    problems.push("MongoDB connection failed.");
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
};

await checkDatabase();

for (const warning of warnings) {
  console.warn(`[setup] Warning: ${warning}`);
}

if (problems.length > 0) {
  console.error("[setup] Incomplete configuration:");
  for (const problem of problems) {
    console.error(`[setup] - ${problem}`);
  }
  process.exitCode = 1;
} else {
  console.log("[setup] Required configuration is present.");
}
