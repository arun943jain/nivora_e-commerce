import app from "./app.js";
import { connectDatabase, disconnectDatabase } from "./config/db.js";
import { env } from "./config/env.js";

let server;
let shuttingDown = false;

const startServer = async () => {
  const database = await connectDatabase();

  server = app.listen(env.port, () => {
    console.log(
      `[server] Nivora API listening on http://localhost:${env.port} (${env.nodeEnv}).`,
    );

    if (!database.connected) {
      console.warn(
        `[server] Database status: ${database.reason}. /api/health is available for checks.`,
      );
    }
  });

  server.on("error", (error) => {
    console.error(`[server] HTTP server error: ${error.name}.`);
    process.exit(1);
  });
};

const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`[server] ${signal} received. Shutting down.`);

  const forceExit = setTimeout(() => {
    process.exit(1);
  }, 10000);
  forceExit.unref();

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    await disconnectDatabase();
    clearTimeout(forceExit);
    process.exit(0);
  } catch {
    process.exit(1);
  }
};

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

startServer().catch((error) => {
  console.error(`[server] Startup failed: ${error.message}`);
  process.exit(1);
});
