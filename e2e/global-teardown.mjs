import {
  TEST_DB_NAME,
  dropTestDatabase,
} from "./scripts/testDatabase.mjs";

/**
 * Drops only `nivora_e2e_test`. The guard inside dropTestDatabase re-checks the
 * live connection name, so the regular `nivora` database can never be touched.
 */
export default async function globalTeardown() {
  await dropTestDatabase();
  console.log(
    `[e2e] Dropped the isolated test database "${TEST_DB_NAME}". The regular database was not touched.`,
  );
}
