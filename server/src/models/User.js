import mongoose from "mongoose";
import { EMAIL_PATTERN, normalizeEmail } from "../utils/validators.js";

const { Schema, model, models } = mongoose;

const USER_ROLES = ["customer", "admin"];
const USER_STATUSES = ["active", "suspended"];

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "User name is required."],
      trim: true,
      maxlength: [120, "User name cannot exceed 120 characters."],
    },
    email: {
      type: String,
      required: [true, "Email is required."],
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: [254, "Email cannot exceed 254 characters."],
      match: [EMAIL_PATTERN, "Email address is not valid."],
      set: normalizeEmail,
    },
    // Only a password hash may ever be stored here. Plaintext passwords are
    // never saved.
    passwordHash: {
      type: String,
      select: false,
    },
    role: {
      type: String,
      enum: {
        values: USER_ROLES,
        message: "Role must be customer or admin.",
      },
      default: "customer",
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: USER_STATUSES,
        message: "Status must be active or suspended.",
      },
      default: "active",
      index: true,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: [30, "Phone cannot exceed 30 characters."],
      default: "",
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

userSchema.index({ createdAt: -1 });
userSchema.index({ role: 1, status: 1 });

export const User = models.User || model("User", userSchema);

export default User;
