import mongoose from "mongoose";
import { Order } from "../models/index.js";
import {
  badRequest,
  conflict,
  notFound,
} from "../utils/httpError.js";
import {
  parseAdminListQuery,
  readEnum,
  searchPattern,
} from "../utils/adminQuery.js";
import {
  allowedOrderTransitions,
  serializeAdminOrder,
} from "../utils/serializers.js";

const ORDER_STATUSES = [
  "Pending",
  "Preparing",
  "Shipped",
  "Delivered",
  "Cancelled",
];

const findAdminOrder = async (id) => {
  const text = String(id || "").trim();

  if (!text || text.length > 60) {
    throw notFound("Order not found.");
  }

  return Order.findOne(
    mongoose.isValidObjectId(text)
      ? { $or: [{ _id: text }, { orderNumber: text }] }
      : { orderNumber: text },
  );
};

export const listAdminOrders = async (req, res) => {
  const query = parseAdminListQuery(req.query, {
    sortable: {
      id: "orderNumber",
      orderNumber: "orderNumber",
      customer: "customer.name",
      createdAt: "createdAt",
      total: "total",
      status: "status",
      paymentStatus: "paymentStatus",
    },
    defaultSort: "createdAt",
    statuses: ORDER_STATUSES,
  });
  const filter = {};

  if (query.status) {
    filter.status = query.status;
  }

  if (query.search) {
    const pattern = searchPattern(query.search);
    filter.$or = [
      { orderNumber: pattern },
      { "customer.name": pattern },
      { "customer.email": pattern },
    ];
  }

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ [query.sort]: query.direction, _id: query.direction })
      .limit(500),
    Order.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: {
      orders: orders.map(serializeAdminOrder),
      total,
    },
  });
};

export const getAdminOrder = async (req, res) => {
  const order = await findAdminOrder(req.params.id);

  if (!order) {
    throw notFound("Order not found.");
  }

  res.status(200).json({
    success: true,
    data: { order: serializeAdminOrder(order) },
  });
};

export const updateAdminOrderStatus = async (req, res) => {
  const order = await findAdminOrder(req.params.id);

  if (!order) {
    throw notFound("Order not found.");
  }

  const source = req.body || {};

  // Payment status, item snapshots, customer details and totals are
  // intentionally not writable here. Reject unexpected fields instead of
  // silently ignoring them.
  if ("paymentStatus" in source) {
    throw badRequest("Payment status cannot be changed in this phase.");
  }

  if (Object.keys(source).some((key) => key !== "status")) {
    throw badRequest("Only the order status can be updated.");
  }

  const status = readEnum(source.status, "Order status", ORDER_STATUSES, {
    required: true,
  });

  if (status === order.status) {
    return res.status(200).json({
      success: true,
      data: { order: serializeAdminOrder(order) },
    });
  }

  const allowed = allowedOrderTransitions(order.status);

  if (!allowed.includes(status)) {
    throw conflict(
      `Order status cannot move from ${order.status} to ${status}. Allowed: ${
        allowed.length > 0 ? allowed.join(", ") : "none"
      }.`,
    );
  }

  order.status = status;
  await order.save();

  res.status(200).json({
    success: true,
    data: { order: serializeAdminOrder(order) },
  });
};
