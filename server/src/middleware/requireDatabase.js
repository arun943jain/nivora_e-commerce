import { getDatabaseStatus, isDatabaseConfigured } from "../config/db.js";
import { serviceUnavailable } from "../utils/httpError.js";

export const requireDatabase = (req, res, next) => {
  if (!isDatabaseConfigured() || getDatabaseStatus() !== "connected") {
    return next(serviceUnavailable("Catalogue is temporarily unavailable."));
  }

  return next();
};
