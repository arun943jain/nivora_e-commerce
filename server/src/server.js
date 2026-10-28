import app from "./app.js";
import {
  connectDatabase,
  disconnectDatabase,
  getDatabaseStatus,
} from "./config/db.js";
import { env } from "./config/env.js";
import { releaseExpiredRazorpayOrders } from "./services/paymentService.js";

let server;
let paymentSweep;
let shuttingDown = false;

const SWEEP_INTERVAL_MS = 60 * 1000;

const startPaymentSweep = (databaseConnected) => {
  if (!env.razorpayEnabled || !databaseConnected) return;

  paymentSweep = setInterval(async () => {
    if (getDatabaseStatus() !== "connected") return;

    try {
      const released = await releaseExpiredRazorpayOrders();

      if (released > 0) {
        console.log(
          `[payments] Released ${released} expired stock reservation(s).`,
        );
      }
    } catch (error) {
      console.error(`[payments] Expiry sweep failed: ${error.message}`);
    }
  }, SWEEP_INTERVAL_MS);
  paymentSweep.unref();
};

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

    if (!env.authConfigured) {
      console.warn(
        "[server] JWT_SECRET is not configured. Authentication endpoints will return 503 until it is set.",
      );
    }

    if (!env.razorpayEnabled) {
      console.warn(
        "[server] Razorpay test keys are not configured. Online payment endpoints will return 503 until RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set.",
      );
    } else if (!env.razorpayWebhookConfigured) {
      console.warn(
        "[server] RAZORPAY_WEBHOOK_SECRET is not configured. Webhook deliveries will be rejected.",
      );
    }

    startPaymentSweep(database.connected);
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
    if (paymentSweep) {
      clearInterval(paymentSweep);
      paymentSweep = null;
    }
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
