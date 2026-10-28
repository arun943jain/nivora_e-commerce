import mongoose from "mongoose";
import { assertTransactionsSupported } from "../config/db.js";
import { Cart, Coupon, Order, Product } from "../models/index.js";
import { loadCartLines } from "../utils/cartData.js";
import {
  calculateCouponDiscount,
  calculateShipping,
  resolveCoupon,
} from "../utils/cartPricing.js";
import { badRequest, conflict, serviceUnavailable } from "../utils/httpError.js";

export const PAYMENT_METHODS = Object.freeze({
  COD: "Cash on delivery",
  RAZORPAY: "Razorpay",
});

export const PAYMENT_RESERVATION_MS = 20 * 60 * 1000;

export class StockUnavailableError extends Error {
  constructor(productName) {
    super(
      productName
        ? `${productName} is no longer available in that quantity.`
        : "One of the items is no longer available.",
    );
    this.name = "StockUnavailableError";
  }
}

const readRequiredText = (value, label, maxLength) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw badRequest(`${label} is required.`);
  }

  const text = value.trim();

  if (text.length > maxLength) {
    throw badRequest(`${label} cannot exceed ${maxLength} characters.`);
  }

  return text;
};

const readOptionalText = (value, label, maxLength) => {
  if (value === undefined || value === null) return "";

  if (typeof value !== "string") {
    throw badRequest(`${label} must be text.`);
  }

  const text = value.trim();

  if (text.length > maxLength) {
    throw badRequest(`${label} cannot exceed ${maxLength} characters.`);
  }

  return text;
};

export const parseCheckoutInput = (
  body,
  { allowedPaymentMethods = [PAYMENT_METHODS.COD] } = {},
) => {
  const source = body?.shippingAddress || body?.address;

  if (!source || typeof source !== "object" || Array.isArray(source)) {
    throw badRequest("A delivery address is required.");
  }

  const shippingAddress = {
    firstName: readRequiredText(source.firstName, "First name", 80),
    lastName: readRequiredText(source.lastName, "Last name", 80),
    address: readRequiredText(source.address, "Address", 240),
    city: readRequiredText(source.city, "City", 120),
    state: readRequiredText(source.state, "State", 120),
    postalCode: readRequiredText(source.postalCode, "Postal code", 20),
    country: readRequiredText(source.country, "Country", 80),
  };
  const phone = readRequiredText(body?.phone, "Phone number", 30);

  if (!/^[0-9+\-\s()]{7,20}$/.test(phone)) {
    throw badRequest("Enter a valid phone number.");
  }

  const requestedMethod = readOptionalText(
    body?.paymentMethod,
    "Payment method",
    40,
  );
  const paymentMethod = requestedMethod || allowedPaymentMethods[0];

  if (!allowedPaymentMethods.includes(paymentMethod)) {
    if (paymentMethod === PAYMENT_METHODS.RAZORPAY) {
      throw badRequest("Use the online payment option to pay with Razorpay.");
    }

    if (allowedPaymentMethods.length === 1) {
      throw badRequest("Only cash on delivery is available.");
    }

    throw badRequest(
      `Payment method must be ${allowedPaymentMethods.join(" or ")}.`,
    );
  }

  return {
    shippingAddress,
    phone,
    paymentMethod,
    notes: readOptionalText(body?.notes, "Order notes", 1000),
    couponCode: readOptionalText(body?.couponCode, "Coupon code", 40),
  };
};

export const prepareCheckout = async ({ userId, couponCode, session }) => {
  const query = Cart.findOne({ user: userId });
  if (session) query.session(session);
  const cart = await query;

  if (!cart || cart.items.length === 0) {
    throw badRequest("Your cart is empty.");
  }

  const { lines, staleCount } = await loadCartLines(cart, { session });

  if (lines.length === 0) {
    throw conflict(
      "None of the items in your cart are available. Update your cart and try again.",
    );
  }

  if (staleCount > 0) {
    throw conflict(
      "Some items in your cart are no longer available. Update your cart and try again.",
    );
  }

  for (const { product, quantity } of lines) {
    if (product.stock < quantity) {
      throw conflict(`${product.name} has only ${product.stock} available.`);
    }
  }

  const subtotal = lines.reduce(
    (total, line) => total + line.product.price * line.quantity,
    0,
  );
  const coupon = await resolveCoupon(couponCode, subtotal, { session });

  return { cart, lines, subtotal, coupon };
};

export const generateOrderNumber = () => {
  const stamp = Date.now().toString().slice(-9);
  const suffix = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");

  return `NV-${stamp}${suffix}`;
};

export const findOpenRazorpayReservation = (userId, { session } = {}) => {
  const query = Order.findOne({
    user: userId,
    paymentMethod: PAYMENT_METHODS.RAZORPAY,
    paymentStatus: { $in: ["Pending", "Failed"] },
    stockReserved: true,
    paymentExpiresAt: { $gt: new Date() },
  }).select("orderNumber");

  if (session) query.session(session);

  return query;
};

const isTransactionUnsupportedError = (error) => {
  const message = String(error?.message || "");

  return (
    (error?.code === 20 && /transaction/i.test(message)) ||
    /transaction numbers are only allowed|does not support transactions|transactions are not supported|transaction support is required/i.test(
      message,
    )
  );
};

export const runCheckoutTransaction = async (work) => {
  await assertTransactionsSupported();

  const session = await mongoose.startSession();
  let result;

  try {
    await session.withTransaction(async () => {
      result = await work(session);
    });
  } catch (error) {
    if (isTransactionUnsupportedError(error)) {
      throw serviceUnavailable(
        "Checkout requires MongoDB transactions. Run the API against a replica set or sharded cluster; standalone MongoDB cannot place orders safely.",
      );
    }

    throw error;
  } finally {
    await session.endSession();
  }

  return result;
};

// Decrements stock for items whose reservation was released after a late
// capture. Throws if any item can no longer be reserved so the caller can
// avoid overselling.
export const reReserveOrderStock = async (order, { session }) => {
  for (const item of order.items) {
    if (!item.product) {
      throw new StockUnavailableError(item.name);
    }

    const result = await Product.updateOne(
      {
        _id: item.product,
        status: "Active",
        stock: { $gte: item.quantity },
      },
      { $inc: { stock: -item.quantity } },
      { session },
    );

    if (result.modifiedCount !== 1) {
      throw new StockUnavailableError(item.name);
    }
  }
};

export const createReservedOrder = async ({
  userId,
  userEmail,
  input,
  paymentMethod,
  paymentExpiresAt = null,
  clearCart = false,
  blockOpenOnlinePayment = false,
}) =>
  runCheckoutTransaction(async (session) => {
    if (blockOpenOnlinePayment) {
      const openPayment = await findOpenRazorpayReservation(userId, {
        session,
      });

      if (openPayment) {
        throw conflict(
          `You have an unfinished online payment for order ${openPayment.orderNumber}. Retry it from your order history, or wait for it to expire before choosing cash on delivery.`,
        );
      }
    }

    const { cart, lines, subtotal, coupon } = await prepareCheckout({
      userId,
      couponCode: input.couponCode,
      session,
    });
    const discount = calculateCouponDiscount(coupon, subtotal);
    const shipping = calculateShipping(subtotal);
    const total = Math.max(0, subtotal - discount + shipping);

    for (const { product, quantity } of lines) {
      const stockResult = await Product.updateOne(
        {
          _id: product._id,
          status: "Active",
          stock: { $gte: quantity },
        },
        { $inc: { stock: -quantity } },
        { session },
      );

      if (stockResult.modifiedCount !== 1) {
        throw conflict(
          `${product.name} is no longer available in that quantity.`,
        );
      }
    }

    if (coupon) {
      const couponFilter = { _id: coupon._id, status: "active" };

      if (coupon.usageLimit != null) {
        couponFilter.$expr = {
          $lt: ["$usedCount", "$usageLimit"],
        };
      }

      const couponResult = await Coupon.updateOne(
        couponFilter,
        { $inc: { usedCount: 1 } },
        { session },
      );

      if (couponResult.modifiedCount !== 1) {
        throw conflict("That coupon has reached its usage limit.");
      }
    }

    const [order] = await Order.create(
      [
        {
          orderNumber: generateOrderNumber(),
          user: userId,
          customer: {
            name: `${input.shippingAddress.firstName} ${input.shippingAddress.lastName}`.trim(),
            email: userEmail,
            phone: input.phone,
          },
          items: lines.map(({ product, quantity }) => ({
            product: product._id,
            productId: product.productId,
            sku: product.sku,
            name: product.name,
            image: product.image,
            price: product.price,
            quantity,
          })),
          shippingAddress: input.shippingAddress,
          subtotal,
          discount,
          shipping,
          total,
          couponCode: coupon?.code || "",
          paymentMethod,
          paymentStatus: "Pending",
          status: "Pending",
          stockReserved: true,
          paymentExpiresAt,
          notes: input.notes,
        },
      ],
      { session },
    );

    if (clearCart) {
      const cleared = await Cart.updateOne(
        { _id: cart._id },
        { $set: { items: [] } },
        { session },
      );

      if (cleared.modifiedCount !== 1) {
        throw new Error("Cart could not be cleared.");
      }
    }

    return order;
  });

// Releases a reservation exactly once, restoring stock and coupon usage. The
// conditional update on `stockReserved` makes duplicate webhooks, admin
// cancellations and expiry sweeps safe to race.
export const releaseOrderReservation = async ({
  orderId,
  paymentStatus = "Failed",
  orderStatus = "Cancelled",
  paymentIssue = "",
}) =>
  runCheckoutTransaction(async (session) => {
    const now = new Date();
    const order = await Order.findOneAndUpdate(
      {
        _id: orderId,
        paymentMethod: PAYMENT_METHODS.RAZORPAY,
        stockReserved: true,
        paymentStatus: { $in: ["Pending", "Failed"] },
      },
      {
        $set: {
          stockReserved: false,
          stockReleasedAt: now,
          paymentExpiresAt: null,
          paymentStatus,
          status: orderStatus,
          paymentIssue,
        },
      },
      { new: true, session },
    );

    if (!order) return null;

    for (const item of order.items) {
      if (!item.product) continue;

      await Product.updateOne(
        { _id: item.product },
        { $inc: { stock: item.quantity } },
        { session },
      );
    }

    if (order.couponCode) {
      await Coupon.updateOne(
        { code: order.couponCode, usedCount: { $gt: 0 } },
        { $inc: { usedCount: -1 } },
        { session },
      );
    }

    return order;
  });

export const findExpiredRazorpayOrders = async ({ limit = 10 } = {}) =>
  Order.find({
    paymentMethod: PAYMENT_METHODS.RAZORPAY,
    paymentStatus: { $in: ["Pending", "Failed"] },
    stockReserved: true,
    paymentExpiresAt: { $ne: null, $lte: new Date() },
  })
    .select("_id razorpay")
    .limit(limit);
