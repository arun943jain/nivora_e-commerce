import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { razorpayWebhook } from "./controllers/paymentController.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import adminRouter from "./routes/admin.js";
import authRouter from "./routes/auth.js";
import cartRouter from "./routes/cart.js";
import catalogueRouter from "./routes/catalogue.js";
import healthRouter from "./routes/health.js";
import ordersRouter from "./routes/orders.js";
import paymentsRouter from "./routes/payments.js";

const app = express();

app.disable("x-powered-by");

// Render and Railway terminate TLS at one reverse proxy. Trusting exactly one
// hop lets the auth rate limiter and request logging see the visitor IP
// without trusting a client-supplied X-Forwarded-For value. Adjust this if you
// put another proxy or CDN in front of the API.
if (env.isProduction) {
  app.set("trust proxy", 1);
}

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = !origin || origin === env.clientOrigin;
      callback(null, allowed);
    },
    credentials: true,
  }),
);
if (env.nodeEnv !== "test") {
  app.use(morgan(env.isProduction ? "combined" : "dev"));
}

// Razorpay signs the exact bytes it sends, so this route must receive the raw
// body before the JSON parser runs. Every other route keeps normal JSON parsing.
app.post(
  "/api/payments/razorpay/webhook",
  express.raw({ type: "application/json", limit: "100kb" }),
  razorpayWebhook,
);

app.use(express.json({ limit: "100kb" }));

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/cart", cartRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api", catalogueRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
