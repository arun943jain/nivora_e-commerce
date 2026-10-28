import { rateLimit } from "express-rate-limit";
import { HttpError } from "../utils/httpError.js";

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (req, res, next) =>
    next(
      new HttpError(
        429,
        "Too many authentication attempts. Please try again later.",
      ),
    ),
});
