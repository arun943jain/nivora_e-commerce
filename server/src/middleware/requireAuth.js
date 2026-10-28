import mongoose from "mongoose";
import { getDatabaseStatus, isDatabaseConfigured } from "../config/db.js";
import { User } from "../models/index.js";
import { AUTH_COOKIE_NAME, readCookie } from "../utils/cookies.js";
import {
  forbidden,
  serviceUnavailable,
  unauthorized,
} from "../utils/httpError.js";
import { verifyAuthToken } from "../utils/authToken.js";

export const requireAuth = async (req, res, next) => {
  try {
    if (!isDatabaseConfigured() || getDatabaseStatus() !== "connected") {
      throw serviceUnavailable("Authentication is temporarily unavailable.");
    }

    const token = readCookie(req.headers.cookie, AUTH_COOKIE_NAME);
    const payload = verifyAuthToken(token);

    if (!mongoose.isValidObjectId(payload.sub)) {
      throw unauthorized();
    }

    const user = await User.findById(payload.sub);

    if (!user || user.status !== "active") {
      throw unauthorized();
    }

    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
};

export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return next(unauthorized());
  }

  if (req.user.role !== "admin") {
    return next(forbidden("Administrator access is required."));
  }

  return next();
};
