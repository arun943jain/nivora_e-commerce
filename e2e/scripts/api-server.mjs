import { spawn } from "node:child_process";
import {
  API_PORT,
  WEB_ORIGIN,
  assertTestDatabaseUri,
  getTestMongoUri,
  serverDir,
} from "./testDatabase.mjs";

// Playwright starts (and stops) this wrapper. It derives the isolated test
// connection string in memory and hands it to the API process through the
// environment, so no secret ever appears on a command line or in a log.
const uri = getTestMongoUri();
assertTestDatabaseUri(uri);

console.log(
  `[e2e] Starting the API against the isolated test database on port ${API_PORT}.`,
);

const child = spawn(process.execPath, ["src/server.js"], {
  cwd: serverDir,
  env: {
    ...process.env,
    MONGODB_URI: uri,
    PORT: String(API_PORT),
    NODE_ENV: "test",
    CLIENT_ORIGIN: WEB_ORIGIN,
  },
  stdio: "inherit",
});

const forward = (signal) => {
  if (!child.killed) child.kill(signal);
};

process.on("SIGINT", () => forward("SIGINT"));
process.on("SIGTERM", () => forward("SIGTERM"));
process.on("exit", () => forward("SIGTERM"));

child.on("exit", (code, signal) => {
  if (signal) process.exit(0);
  process.exit(code ?? 0);
});
