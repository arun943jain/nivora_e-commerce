import mongoose from "mongoose";
import {
  Cart,
  Coupon,
  Order,
  Product,
} from "../models/index.js";
import { assertTransactionsSupported } from "../config/db.js";
import { loadCartLines } from "../utils/cartData.js";
import {
  calculateCouponDiscount,
  calculateShipping,
  resolveCoupon,
} from "../utils/cartPricing.js";
import {
  badRequest,
  conflict,
  notFound,
  serviceUnavailable,
} from "../utils/httpError.js";
import { serializeOrder } from "../utils/serializers.js";

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

const parseCheckoutInput = (body) => {
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

  const paymentMethod = readOptionalText(
    body?.paymentMethod,
    "Payment method",
    40,
  );

  if (paymentMethod && paymentMethod !== "Cash on delivery") {
    throw badRequest("Only cash on delivery is available.");
  }

  return {
    shippingAddress,
    phone,
    notes: readOptionalText(body?.notes, "Order notes", 1000),
    couponCode: readOptionalText(body?.couponCode, "Coupon code", 40),
  };
};

const prepareCheckout = async ({ userId, couponCode, session }) => {
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
      throw conflict(
        `${product.name} has only ${product.stock} available.`,
      );
    }
  }

  const subtotal = lines.reduce(
    (total, line) => total + line.product.price * line.quantity,
    0,
  );
  const coupon = await resolveCoupon(couponCode, subtotal, { session });

  return { cart, lines, subtotal, coupon };
};

const generateOrderNumber = () => {
  const stamp = Date.now().toString().slice(-9);
  const suffix = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");

  return `NV-${stamp}${suffix}`;
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

export const createOrder = async (req, res) => {
  const input = parseCheckoutInput(req.body);

  await assertTransactionsSupported();

  const session = await mongoose.startSession();
  let order;

  try {
    await session.withTransaction(async () => {
      const { cart, lines, subtotal, coupon } = await prepareCheckout({
        userId: req.user._id,
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

      const [created] = await Order.create(
        [
          {
            orderNumber: generateOrderNumber(),
            user: req.user._id,
            customer: {
              name: `${input.shippingAddress.firstName} ${input.shippingAddress.lastName}`.trim(),
              email: req.user.email,
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
            paymentMethod: "Cash on delivery",
            paymentStatus: "Pending",
            status: "Pending",
            notes: input.notes,
          },
        ],
        { session },
      );

      order = created;

      const cleared = await Cart.updateOne(
        { _id: cart._id },
        { $set: { items: [] } },
        { session },
      );

      if (cleared.modifiedCount !== 1) {
        throw new Error("Cart could not be cleared.");
      }
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

  if (!order) {
    throw new Error("Order could not be created.");
  }

  res.status(201).json({
    success: true,
    data: { order: serializeOrder(order) },
  });
};

export const listOrders = async (req, res) => {
  const orders = await Order.find({ user: req.user._id })
    .sort({ createdAt: -1, _id: -1 })
    .limit(50);

  res.status(200).json({
    success: true,
    data: { orders: orders.map(serializeOrder) },
  });
};

export const getOrderById = async (req, res) => {
  const id = String(req.params.id || "").trim();

  if (!id || id.length > 60) {
    throw notFound("Order not found.");
  }

  const filters = [{ orderNumber: id }];

  if (mongoose.isValidObjectId(id)) {
    filters.push({ _id: id });
  }

  const order = await Order.findOne({
    user: req.user._id,
    $or: filters,
  });

  if (!order) {
    throw notFound("Order not found.");
  }

  res.status(200).json({
    success: true,
    data: { order: serializeOrder(order) },
  });
};
