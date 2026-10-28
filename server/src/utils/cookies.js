import { env } from "../config/env.js";

export const AUTH_COOKIE_NAME = "nivora_session";

const baseCookieOptions = () => ({
  httpOnly: true,
  // SameSite=None is only honoured by browsers on Secure cookies.
  secure: env.isProduction || env.cookieSameSite === "none",
  sameSite: env.cookieSameSite,
  path: "/",
});

export const readCookie = (cookieHeader, name) => {
  if (!cookieHeader || !name) return "";

  for (const part of String(cookieHeader).split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;

    if (part.slice(0, separator).trim() !== name) continue;

    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return "";
    }
  }

  return "";
};

export const setAuthCookie = (res, token, expiresAtSeconds) => {
  const expiresAt =
    Number.isFinite(expiresAtSeconds) && expiresAtSeconds > 0
      ? expiresAtSeconds * 1000
      : Date.now() + 7 * 24 * 60 * 60 * 1000;

  res.cookie(AUTH_COOKIE_NAME, token, {
    ...baseCookieOptions(),
    maxAge: Math.max(0, expiresAt - Date.now()),
  });
};

export const clearAuthCookie = (res) => {
  res.clearCookie(AUTH_COOKIE_NAME, baseCookieOptions());
};
