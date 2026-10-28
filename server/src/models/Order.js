import mongoose from "mongoose";
import { normalizeEmail } from "../utils/validators.js";

const { Schema, model, models } = mongoose;

const ORDER_STATUSES = [
  "Pending",
  "Preparing",
  "Shipped",
  "Delivered",
  "Cancelled",
];
const PAYMENT_METHODS = [
  "Cash on delivery",
  "Razorpay",
  "Card",
  "UPI",
  "Net banking",
];
const PAYMENT_STATUSES = ["Pending", "Paid", "Refunded", "Failed"];

const razorpayAttemptSchema = new Schema(
  {
    orderId: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, "Razorpay order ID is too long."],
    },
    paymentId: {
      type: String,
      trim: true,
      default: "",
      maxlength: [100, "Razorpay payment ID is too long."],
    },
    status: {
      type: String,
      enum: ["created", "paid", "failed"],
      default: "created",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false },
);

const razorpaySchema = new Schema(
  {
    orderId: {
      type: String,
      trim: true,
      default: "",
      maxlength: [100, "Razorpay order ID is too long."],
    },
    paymentId: {
      type: String,
      trim: true,
      default: "",
      maxlength: [100, "Razorpay payment ID is too long."],
    },
    attempts: {
      type: [razorpayAttemptSchema],
      default: [],
    },
  },
  { _id: false },
);

const orderItemSchema = new Schema(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    // Snapshot of the product at purchase time so later edits do not rewrite history.
    productId: {
      type: String,
      trim: true,
      default: "",
    },
    sku: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    name: {
      type: String,
      required: [true, "Order item name is required."],
      trim: true,
      maxlength: [160, "Order item name cannot exceed 160 characters."],
    },
    image: {
      type: String,
      trim: true,
      maxlength: [2048, "Order item image URL is too long."],
      default: "",
    },
    price: {
      type: Number,
      required: [true, "Order item price is required."],
      min: [0, "Order item price cannot be negative."],
    },
    quantity: {
      type: Number,
      required: [true, "Order item quantity is required."],
      min: [1, "Order item quantity must be at least 1."],
      validate: {
        validator: Number.isInteger,
        message: "Order item quantity must be a whole number.",
      },
    },
  },
  { _id: false },
);

const addressSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    postalCode: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const orderSchema = new Schema(
  {
    orderNumber: {
      type: String,
      required: [true, "Order number is required."],
      unique: true,
      trim: true,
      maxlength: [40, "Order number cannot exceed 40 characters."],
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    customer: {
      name: {
        type: String,
        required: [true, "Customer name is required."],
        trim: true,
      },
      email: {
        type: String,
        required: [true, "Customer email is required."],
        trim: true,
        lowercase: true,
        set: normalizeEmail,
      },
      phone: {
        type: String,
        trim: true,
        default: "",
      },
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: "An order must contain at least one item.",
      },
    },
    shippingAddress: {
      type: addressSchema,
      required: true,
    },
    subtotal: {
      type: Number,
      required: true,
      min: [0, "Subtotal cannot be negative."],
    },
    discount: {
      type: Number,
      min: [0, "Discount cannot be negative."],
      default: 0,
    },
    shipping: {
      type: Number,
      min: [0, "Shipping cost cannot be negative."],
      default: 0,
    },
    total: {
      type: Number,
      required: true,
      min: [0, "Order total cannot be negative."],
    },
    couponCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    paymentMethod: {
      type: String,
      enum: {
        values: PAYMENT_METHODS,
        message: "Unsupported payment method.",
      },
      default: "Cash on delivery",
    },
    paymentStatus: {
      type: String,
      enum: {
        values: PAYMENT_STATUSES,
        message: "Unsupported payment status.",
      },
      default: "Pending",
    },
    // Online payments reserve stock until the gateway confirms capture. The
    // expiry sweep releases abandoned reservations exactly once.
    stockReserved: {
      type: Boolean,
      default: true,
    },
    paymentExpiresAt: {
      type: Date,
      default: null,
    },
    stockReleasedAt: {
      type: Date,
      default: null,
    },
    paymentIssue: {
      type: String,
      trim: true,
      maxlength: [500, "Payment note cannot exceed 500 characters."],
      default: "",
    },
    razorpay: {
      type: razorpaySchema,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: {
        values: ORDER_STATUSES,
        message: "Unsupported order status.",
      },
      default: "Pending",
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Order notes cannot exceed 1000 characters."],
      default: "",
    },
  },
  { timestamps: true },
);

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ "customer.email": 1, createdAt: -1 });
orderSchema.index({ createdAt: -1 });
// Payment lookups only ever use identifiers stored on the internal order.
orderSchema.index({ "razorpay.orderId": 1 });
orderSchema.index({ "razorpay.attempts.orderId": 1 });
orderSchema.index({ paymentMethod: 1, paymentStatus: 1, paymentExpiresAt: 1 });

export const Order = models.Order || model("Order", orderSchema);

export default Order;
