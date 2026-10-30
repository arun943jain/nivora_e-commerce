import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// The e2e harness intentionally reuses the API's own dependencies (mongoose,
// dotenv) instead of installing a second copy. createRequire resolves them from
// server/package.json, so nothing is hoisted into this folder.
const here = path.dirname(fileURLToPath(import.meta.url));

export const repoRoot = path.resolve(here, "..", "..");
export const serverDir = path.join(repoRoot, "server");
export const artifactsDir = path.resolve(here, "..", ".artifacts");

export const TEST_DB_NAME = "nivora_e2e_test";
export const API_PORT = Number(process.env.E2E_API_PORT || 5055);
export const WEB_PORT = Number(process.env.E2E_WEB_PORT || 5174);
export const API_ORIGIN = `http://127.0.0.1:${API_PORT}`;
export const WEB_ORIGIN = `http://127.0.0.1:${WEB_PORT}`;

const requireFromServer = createRequire(path.join(serverDir, "package.json"));

const fail = (message) => {
  throw new Error(`[e2e] ${message}`);
};

let envLoaded = false;

/**
 * Loads server/.env exactly like the API does. Values are never returned by any
 * function that prints; only presence checks are exposed.
 */
export const loadServerEnv = () => {
  if (envLoaded) return process.env;

  const dotenv = requireFromServer("dotenv");
  const result = dotenv.config({
    path: path.join(serverDir, ".env"),
    quiet: true,
  });

  if (result.error) {
    fail(
      "server/.env could not be read. Create it from server/.env.example and fill in the values before running the suite.",
    );
  }

  envLoaded = true;
  return process.env;
};

const splitConnectionString = (raw) => {
  const match = /^(mongodb(?:\+srv)?):\/\//i.exec(raw);

  if (!match) {
    fail("MONGODB_URI is not a MongoDB connection string.");
  }

  const schemeLength = match[0].length;
  const queryIndex = raw.indexOf("?", schemeLength);
  const pathEnd = queryIndex === -1 ? raw.length : queryIndex;
  const authority = raw.slice(schemeLength, pathEnd);
  const slashIndex = authority.lastIndexOf("/");

  return {
    schemeLength,
    authority,
    slashIndex,
    queryIndex,
    pathEnd,
    scheme: match[1].toLowerCase(),
  };
};

/** Reads the database name from a connection string without logging it. */
export const readDatabaseName = (uri) => {
  const raw = String(uri || "").trim();

  if (!raw) return "";

  const { schemeLength, slashIndex, pathEnd } = splitConnectionString(raw);

  if (slashIndex === -1) return "";

  const pathPart = raw.slice(schemeLength + slashIndex + 1, pathEnd);

  if (!pathPart) return "";

  return decodeURIComponent(pathPart.split("/")[0] || "");
};

/** Swaps the database path for the dedicated test database, preserving auth/options. */
export const deriveTestUri = (uri) => {
  const raw = String(uri || "").trim();

  if (!raw) {
    fail(
      "MONGODB_URI is not set. Add your Atlas connection string to server/.env so the isolated test database can be derived from it.",
    );
  }

  const { schemeLength, slashIndex, pathEnd, queryIndex } =
    splitConnectionString(raw);

  const prefix =
    slashIndex === -1
      ? raw.slice(0, pathEnd)
      : raw.slice(0, schemeLength + slashIndex);
  const base = `${prefix.replace(/\/+$/, "")}/${TEST_DB_NAME}`;

  return queryIndex === -1 ? base : `${base}${raw.slice(pathEnd)}`;
};

/**
 * Hard guard: every script and test that touches MongoDB calls this first. It
 * refuses to continue unless the URL selects exactly `nivora_e2e_test`.
 */
export const assertTestDatabaseUri = (uri) => {
  const name = readDatabaseName(uri);

  if (name !== TEST_DB_NAME) {
    fail(
      `Refusing to run: the selected database is not "${TEST_DB_NAME}". ` +
        "Tear-down, seeding and API startup all require the dedicated test database.",
    );
  }

  const { scheme } = splitConnectionString(String(uri));
  return { scheme };
};

let cachedTestUri = "";

/**
 * Derives and caches the guarded test connection string. The value is held in
 * memory only; callers must never log it, and it is only passed to child
 * process environments.
 */
export const getTestMongoUri = () => {
  if (cachedTestUri) return cachedTestUri;

  loadServerEnv();

  const derived = deriveTestUri(process.env.MONGODB_URI);
  assertTestDatabaseUri(derived);

  cachedTestUri = derived;
  return cachedTestUri;
};

export const getServerMongoose = () => requireFromServer("mongoose");

/** Presence-only summary used in reports. Never returns secrets. */
export const describeConfig = () => {
  loadServerEnv();

  const has = (name) => String(process.env[name] || "").trim().length > 0;
  const keyId = String(process.env.RAZORPAY_KEY_ID || "").trim();

  return {
    database: has("MONGODB_URI") ? "derived + guarded" : "missing",
    jwtSecret: has("JWT_SECRET"),
    razorpayKeyId: has("RAZORPAY_KEY_ID"),
    razorpayTestKey:
      keyId.startsWith("rzp_test_") && has("RAZORPAY_KEY_SECRET"),
    razorpayLiveKey: keyId.startsWith("rzp_live_"),
    webhookSecret: has("RAZORPAY_WEBHOOK_SECRET"),
  };
};

/** The webhook secret is read in-process for signed fixtures; it is never returned to output. */
export const getWebhookSecret = () => {
  loadServerEnv();
  const secret = String(process.env.RAZORPAY_WEBHOOK_SECRET || "").trim();
  return secret;
};

/** Connects with the guarded URI and verifies the live connection name and transaction support. */
export const verifyTestDatabaseConnection = async () => {
  const uri = getTestMongoUri();
  const mongoose = getServerMongoose();

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  } catch {
    fail(
      "Could not connect to the test database. Check that the Atlas cluster is reachable and that the database user can create databases.",
    );
  }

  const name = mongoose.connection.db.databaseName;

  if (name !== TEST_DB_NAME) {
    await mongoose.disconnect().catch(() => {});
    fail(
      `Connected database "${name}" is not the isolated test database. Refusing to continue.`,
    );
  }

  try {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    const transactions =
      Boolean(hello.setName) || hello.msg === "isdbgrid";

    if (!transactions) {
      await mongoose.disconnect().catch(() => {});
      fail(
        "The test database deployment does not support transactions. Checkout tests need a replica set; use an Atlas cluster.",
      );
    }
  } catch (error) {
    await mongoose.disconnect().catch(() => {});
    if (error?.message?.startsWith("[e2e]")) throw error;
    fail("Could not verify transaction support on the test database.");
  }

  return mongoose;
};

/** Drops only the dedicated test database, after re-checking its exact name. */
export const dropTestDatabase = async () => {
  const mongoose = getServerMongoose();
  const connected = mongoose.connection.readyState === 1;

  if (!connected) {
    await verifyTestDatabaseConnection();
  }

  const name = mongoose.connection.db.databaseName;

  if (name !== TEST_DB_NAME) {
    fail("Refusing to drop a database that is not the isolated test database.");
  }

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect().catch(() => {});
};
