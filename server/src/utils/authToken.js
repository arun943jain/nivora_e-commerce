import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { serviceUnavailable, unauthorized } from "./httpError.js";

const TOKEN_ISSUER = "nivora-api";
const TOKEN_AUDIENCE = "nivora-web";

export const ensureAuthConfigured = () => {
  if (!env.authConfigured) {
    throw serviceUnavailable("Authentication is temporarily unavailable.");
  }
};

export const signAuthToken = (user) => {
  ensureAuthConfigured();

  const token = jwt.sign({ sub: String(user._id) }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
    algorithm: "HS256",
  });
  const decoded = jwt.decode(token);

  if (!decoded || typeof decoded !== "object" || !decoded.exp) {
    throw serviceUnavailable("Authentication is temporarily unavailable.");
  }

  return { token, expiresAt: decoded.exp };
};

export const verifyAuthToken = (token) => {
  ensureAuthConfigured();

  if (!token) {
    throw unauthorized();
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret, {
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
      algorithms: ["HS256"],
    });

    if (
      !payload ||
      typeof payload !== "object" ||
      typeof payload.sub !== "string" ||
      !payload.sub
    ) {
      throw unauthorized();
    }

    return payload;
  } catch {
    throw unauthorized();
  }
};
