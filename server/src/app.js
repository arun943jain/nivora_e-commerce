import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import authRouter from "./routes/auth.js";
import catalogueRouter from "./routes/catalogue.js";
import healthRouter from "./routes/health.js";

const app = express();

app.disable("x-powered-by");

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
app.use(express.json({ limit: "100kb" }));

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api", catalogueRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
