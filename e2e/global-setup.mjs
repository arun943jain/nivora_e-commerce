import { spawnSync } from "node:child_process";
import {
  TEST_DB_NAME,
  describeConfig,
  dropTestDatabase,
  getTestMongoUri,
  loadServerEnv,
  serverDir,
  verifyTestDatabaseConnection,
} from "./scripts/testDatabase.mjs";

/**
 * Runs before every visible suite:
 * 1. derive + guard the test database from server/.env (never printed);
 * 2. refuse to continue unless the deployment supports transactions;
 * 3. drop only `nivora_e2e_test` so runs start from a clean slate;
 * 4. load the real sample catalogue with the project's own seed command.
 */
export default async function globalSetup() {
  const config = describeConfig();
  console.log("[e2e] Configuration presence:", JSON.stringify(config));

  if (!config.jwtSecret) {
    throw new Error(
      "[e2e] JWT_SECRET is missing from server/.env, so authentication tests cannot run.",
    );
  }

  const mongoose = await verifyTestDatabaseConnection();
  console.log(
    `[e2e] Verified connection to the isolated database "${TEST_DB_NAME}" (replica set, transactions supported).`,
  );
  await mongoose.disconnect();

  // Drop and reseed within the guarded database only.
  await dropTestDatabase();
  console.log("[e2e] Dropped and re-created the isolated test database.");

  const uri = getTestMongoUri();
  loadServerEnv();

  const seed = spawnSync(process.execPath, ["src/seed/seed.js"], {
    cwd: serverDir,
    env: { ...process.env, MONGODB_URI: uri, NODE_ENV: "test" },
    encoding: "utf8",
  });

  if (seed.status !== 0) {
    throw new Error(
      `[e2e] Seeding the test database failed: ${
        (seed.stderr || "").trim().split("\n").slice(-2).join(" ") ||
        "see the server log"
      }`,
    );
  }

  const summary =
    (seed.stdout || "")
      .split("\n")
      .filter((line) => line.includes("[seed]"))
      .slice(-5)
      .join(" ");
  console.log("[e2e] Test database seeded.", summary || "");
}
