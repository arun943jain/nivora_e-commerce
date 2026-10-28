import mongoose from "mongoose";
import { Order } from "../models/index.js";
import { notFound } from "../utils/httpError.js";
import { serializeOrder } from "../utils/serializers.js";
import {
  PAYMENT_METHODS,
  createReservedOrder,
  parseCheckoutInput,
} from "../services/checkoutService.js";

export const createOrder = async (req, res) => {
  const input = parseCheckoutInput(req.body, {
    allowedPaymentMethods: [PAYMENT_METHODS.COD],
  });

  const order = await createReservedOrder({
    userId: req.user._id,
    userEmail: req.user.email,
    input,
    paymentMethod: PAYMENT_METHODS.COD,
    clearCart: true,
    blockOpenOnlinePayment: true,
  });

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
