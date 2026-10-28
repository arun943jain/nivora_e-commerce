import { env } from "../config/env.js";

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found.",
  });
};

export const errorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON payload.",
    });
  }

  if (error.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      message: "Request payload is too large.",
    });
  }

  if (error?.name === "ValidationError") {
    const firstError = Object.values(error.errors || {})[0];

    return res.status(400).json({
      success: false,
      message: firstError?.message || "The submitted data is invalid.",
    });
  }

  if (error?.code === 11000) {
    const field =
      Object.keys(error.keyPattern || error.keyValue || {})[0] || "value";

    return res.status(409).json({
      success: false,
      message: `A record with that ${field} already exists.`,
    });
  }

  if (error?.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "The submitted identifier is invalid.",
    });
  }

  const requestedStatus = Number(error.statusCode || error.status) || 500;
  const statusCode =
    requestedStatus >= 400 && requestedStatus <= 599 ? requestedStatus : 500;
  const isServerError = statusCode >= 500;

  if (isServerError && !env.isProduction && error.expose !== true) {
    console.error("[error]", error.stack || error.message);
  }

  const message =
    isServerError && error.expose !== true
      ? "Internal server error."
      : error.message || "Request failed.";

  return res.status(statusCode).json({
    success: false,
    message,
  });
};
