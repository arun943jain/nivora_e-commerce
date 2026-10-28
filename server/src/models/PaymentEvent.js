import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

const PAYMENT_EVENT_STATUSES = [
  "received",
  "processed",
  "ignored",
  "failed",
];

// Razorpay retries webhooks and may deliver them out of order. The event id is
// unique, so duplicate deliveries are treated as no-ops. Only routing metadata
// is stored here; raw webhook payloads can contain personal data.
const paymentEventSchema = new Schema(
  {
    eventId: {
      type: String,
      required: [true, "Webhook event ID is required."],
      unique: true,
      trim: true,
      maxlength: [200, "Webhook event ID is too long."],
    },
    event: {
      type: String,
      trim: true,
      maxlength: [100, "Webhook event name is too long."],
      default: "",
    },
    status: {
      type: String,
      enum: {
        values: PAYMENT_EVENT_STATUSES,
        message: "Unsupported payment event status.",
      },
      default: "received",
    },
    razorpayOrderId: {
      type: String,
      trim: true,
      maxlength: [100, "Razorpay order ID is too long."],
      default: "",
    },
    paymentId: {
      type: String,
      trim: true,
      maxlength: [100, "Razorpay payment ID is too long."],
      default: "",
    },
    detail: {
      type: String,
      trim: true,
      maxlength: [500, "Payment event detail is too long."],
      default: "",
    },
  },
  { timestamps: true },
);

paymentEventSchema.index({ status: 1, createdAt: -1 });

export const PaymentEvent =
  models.PaymentEvent || model("PaymentEvent", paymentEventSchema);

export default PaymentEvent;
