import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

const COUPON_TYPES = ["percentage", "fixed"];
const COUPON_STATUSES = ["active", "inactive"];

const couponSchema = new Schema(
  {
    code: {
      type: String,
      required: [true, "Coupon code is required."],
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: [40, "Coupon code cannot exceed 40 characters."],
      set: (value) => String(value || "").trim().toUpperCase(),
    },
    description: {
      type: String,
      trim: true,
      maxlength: [200, "Coupon description cannot exceed 200 characters."],
      default: "",
    },
    discountType: {
      type: String,
      required: true,
      enum: {
        values: COUPON_TYPES,
        message: "Discount type must be percentage or fixed.",
      },
    },
    amount: {
      type: Number,
      required: [true, "Coupon amount is required."],
      min: [0, "Coupon amount cannot be negative."],
      validate: {
        validator(value) {
          return this.discountType !== "percentage" || value <= 100;
        },
        message: "Percentage discount cannot exceed 100.",
      },
    },
    minimumOrder: {
      type: Number,
      min: [0, "Minimum order cannot be negative."],
      default: 0,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: {
        values: COUPON_STATUSES,
        message: "Coupon status must be active or inactive.",
      },
      default: "active",
    },
    usageLimit: {
      type: Number,
      min: [1, "Usage limit must be at least 1."],
      default: null,
    },
    usedCount: {
      type: Number,
      min: [0, "Used count cannot be negative."],
      default: 0,
    },
  },
  { timestamps: true },
);

couponSchema.index({ status: 1, expiresAt: 1 });
couponSchema.index({ minimumOrder: 1 });

export const Coupon = models.Coupon || model("Coupon", couponSchema);

export default Coupon;
