import mongoose from "mongoose";
import { env } from "./env.js";
import { serviceUnavailable } from "../utils/httpError.js";

const CONNECTION_STATES = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

export const isDatabaseConfigured = () => Boolean(env.mongodbUri);

export const getDatabaseStatus = () => {
  if (!isDatabaseConfigured()) return "not_configured";
  return CONNECTION_STATES[mongoose.connection.readyState] || "unknown";
};

export const connectDatabase = async () => {
  if (!isDatabaseConfigured()) {
    console.warn(
      "[database] MONGODB_URI is not set. Starting without MongoDB; /api/health will report it as not_configured.",
    );
    return { connected: false, reason: "not_configured" };
  }

  try {
    await mongoose.connect(env.mongodbUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log("[database] MongoDB connection established.");
    return { connected: true, reason: "connected" };
  } catch {
    if (env.isProduction) {
      throw new Error("MongoDB connection failed.");
    }

    console.warn(
      "[database] MongoDB connection failed in development; continuing without a database connection.",
    );
    return { connected: false, reason: "disconnected" };
  }
};

export const disconnectDatabase = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
};

export const assertTransactionsSupported = async () => {
  if (getDatabaseStatus() !== "connected") {
    throw serviceUnavailable("Checkout is temporarily unavailable.");
  }

  let hello;

  try {
    hello = await mongoose.connection.db.admin().command({ hello: 1 });
  } catch {
    throw serviceUnavailable(
      "Checkout requires a MongoDB deployment with transaction support.",
    );
  }

  const supported = Boolean(hello.setName) || hello.msg === "isdbgrid";

  if (!supported) {
    throw serviceUnavailable(
      "Checkout requires MongoDB transactions. Run the API against a replica set or sharded cluster; standalone MongoDB cannot place orders safely.",
    );
  }
};
