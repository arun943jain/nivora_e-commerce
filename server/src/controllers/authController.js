import bcrypt from "bcryptjs";
import { User } from "../models/index.js";
import { clearAuthCookie, setAuthCookie } from "../utils/cookies.js";
import { conflict, unauthorized } from "../utils/httpError.js";
import {
  parseDisplayName,
  parseEmailAddress,
  parsePassword,
} from "../utils/authValidation.js";
import { ensureAuthConfigured, signAuthToken } from "../utils/authToken.js";
import { serializeUser } from "../utils/serializers.js";
import { EMAIL_PATTERN, normalizeEmail } from "../utils/validators.js";

const BCRYPT_ROUNDS = 12;
// Compared against when no account exists so login timing does not reveal
// whether an email address is registered.
const DUMMY_PASSWORD_HASH =
  "$2b$12$gmTLvhvYmiuZWtTP8LNjDufIX78yxhWH9yTrJuMLCBP3LHQlV1jxO";

const startSession = (res, user) => {
  const { token, expiresAt } = signAuthToken(user);
  setAuthCookie(res, token, expiresAt);
};

export const register = async (req, res) => {
  ensureAuthConfigured();

  const name = parseDisplayName(req.body?.name);
  const email = parseEmailAddress(req.body?.email);
  const password = parsePassword(req.body?.password);

  if (await User.exists({ email })) {
    throw conflict("An account with this email already exists.");
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  let user;

  try {
    user = await User.create({
      name,
      email,
      passwordHash,
      role: "customer",
      status: "active",
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw conflict("An account with this email already exists.");
    }

    throw error;
  }

  startSession(res, user);

  res.status(201).json({
    success: true,
    data: { user: serializeUser(user) },
  });
};

export const login = async (req, res) => {
  ensureAuthConfigured();

  const email = normalizeEmail(req.body?.email);
  const password =
    typeof req.body?.password === "string" ? req.body.password : "";
  const invalidCredentials = () =>
    unauthorized("Invalid email or password.");

  if (
    !EMAIL_PATTERN.test(email) ||
    !password ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    throw invalidCredentials();
  }

  const user = await User.findOne({ email }).select("+passwordHash");
  const passwordHash = user?.passwordHash || DUMMY_PASSWORD_HASH;
  const matches = await bcrypt.compare(password, passwordHash);

  if (!user || !matches || !user.passwordHash || user.status !== "active") {
    throw invalidCredentials();
  }

  user.lastLoginAt = new Date();
  await user.save();
  startSession(res, user);

  res.status(200).json({
    success: true,
    data: { user: serializeUser(user) },
  });
};

export const logout = (req, res) => {
  clearAuthCookie(res);

  res.status(200).json({
    success: true,
    message: "Signed out.",
  });
};

export const currentUser = (req, res) => {
  res.status(200).json({
    success: true,
    data: { user: serializeUser(req.user) },
  });
};
