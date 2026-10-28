import { badRequest } from "./httpError.js";
import { EMAIL_PATTERN, normalizeEmail } from "./validators.js";

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 120;
const EMAIL_MAX_LENGTH = 254;
const PASSWORD_MIN_LENGTH = 8;
// bcrypt only considers the first 72 bytes of a password.
const PASSWORD_MAX_BYTES = 72;

export const parseDisplayName = (value) => {
  if (typeof value !== "string") {
    throw badRequest("Enter your full name.");
  }

  const name = value.trim().replace(/\s+/g, " ");

  if (name.length < NAME_MIN_LENGTH || name.length > NAME_MAX_LENGTH) {
    throw badRequest(
      `Name must be between ${NAME_MIN_LENGTH} and ${NAME_MAX_LENGTH} characters.`,
    );
  }

  return name;
};

export const parseEmailAddress = (
  value,
  message = "Enter a valid email address.",
) => {
  const email = normalizeEmail(value);

  if (
    !email ||
    email.length > EMAIL_MAX_LENGTH ||
    !EMAIL_PATTERN.test(email)
  ) {
    throw badRequest(message);
  }

  return email;
};

export const parsePassword = (value) => {
  if (typeof value !== "string" || value.length < PASSWORD_MIN_LENGTH) {
    throw badRequest(
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    );
  }

  if (Buffer.byteLength(value, "utf8") > PASSWORD_MAX_BYTES) {
    throw badRequest("Password is too long.");
  }

  return value;
};
