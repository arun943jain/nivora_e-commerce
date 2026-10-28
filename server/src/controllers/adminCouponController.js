import mongoose from "mongoose";
import { Coupon } from "../models/index.js";
import {
  badRequest,
  conflict,
  notFound,
} from "../utils/httpError.js";
import {
  hasField,
  parseAdminListQuery,
  readDate,
  readEnum,
  readNumber,
  readText,
  searchPattern,
} from "../utils/adminQuery.js";
import { serializeAdminCoupon } from "../utils/serializers.js";

const DISCOUNT_TYPES = ["percentage", "fixed"];
const COUPON_STATUSES = ["active", "inactive"];

const findAdminCoupon = async (id) => {
  const text = String(id || "").trim();

  if (!text || !mongoose.isValidObjectId(text)) {
    throw notFound("Coupon not found.");
  }

  const coupon = await Coupon.findById(text);

  if (!coupon) {
    throw notFound("Coupon not found.");
  }

  return coupon;
};

const normalizeCode = (value) =>
  readText(value, "Coupon code", { required: true, max: 40 }).toUpperCase();

const ensureUniqueCode = async (code, excludeId) => {
  const filter = { code };

  if (excludeId) {
    filter._id = { $ne: excludeId };
  }

  if (await Coupon.exists(filter)) {
    throw conflict("A coupon with that code already exists.");
  }
};

const readDiscountType = (value) =>
  readEnum(value, "Discount type", DISCOUNT_TYPES, { required: true });

const readAmount = (value, discountType) => {
  const amount = readNumber(value, "Discount value", {
    required: true,
    min: 0,
    max: discountType === "percentage" ? 100 : 10000000,
  });

  if (discountType === "percentage" && amount > 100) {
    throw badRequest("Percentage discount cannot exceed 100.");
  }

  return amount;
};

const readUsageLimit = (value) =>
  readNumber(value, "Usage limit", {
    allowNull: true,
    integer: true,
    min: 1,
    max: 1000000,
  });

const rejectUsageEdits = (source) => {
  if (hasField(source, "usedCount")) {
    throw badRequest(
      "Coupon usage is recorded by orders and cannot be edited here.",
    );
  }
};

export const listAdminCoupons = async (req, res) => {
  const query = parseAdminListQuery(req.query, {
    sortable: {
      code: "code",
      discountType: "discountType",
      amount: "amount",
      minimumOrder: "minimumOrder",
      expiresAt: "expiresAt",
      status: "status",
      usedCount: "usedCount",
      createdAt: "createdAt",
    },
    defaultSort: "createdAt",
    statuses: COUPON_STATUSES,
  });
  const filter = {};

  if (query.status) {
    filter.status = query.status;
  }

  if (query.search) {
    const pattern = searchPattern(query.search);
    filter.$or = [{ code: pattern }, { description: pattern }];
  }

  const [coupons, total] = await Promise.all([
    Coupon.find(filter)
      .sort({ [query.sort]: query.direction, _id: query.direction })
      .limit(500),
    Coupon.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: {
      coupons: coupons.map(serializeAdminCoupon),
      total,
    },
  });
};

export const createAdminCoupon = async (req, res) => {
  const source = req.body || {};
  rejectUsageEdits(source);
  const code = normalizeCode(source.code);
  const discountType = readDiscountType(source.discountType);
  const amount = readAmount(source.amount, discountType);
  const minimumOrder = readNumber(source.minimumOrder, "Minimum order", {
    min: 0,
    max: 10000000,
  });
  const usageLimit = readUsageLimit(source.usageLimit);

  await ensureUniqueCode(code);

  const coupon = await Coupon.create({
    code,
    description: readText(source.description, "Description", { max: 200 }),
    discountType,
    amount,
    minimumOrder,
    expiresAt: readDate(source.expiresAt, "Expiry date"),
    status: readEnum(source.status, "Status", COUPON_STATUSES, {
      fallback: "active",
    }),
    usageLimit,
    usedCount: 0,
  });

  res.status(201).json({
    success: true,
    data: { coupon: serializeAdminCoupon(coupon) },
  });
};

export const updateAdminCoupon = async (req, res) => {
  const source = req.body || {};
  rejectUsageEdits(source);
  const coupon = await findAdminCoupon(req.params.id);

  if (hasField(source, "code")) {
    const code = normalizeCode(source.code);
    await ensureUniqueCode(code, coupon._id);
    coupon.code = code;
  }

  if (hasField(source, "discountType")) {
    coupon.discountType = readDiscountType(source.discountType);
  }

  if (hasField(source, "amount")) {
    coupon.amount = readAmount(source.amount, coupon.discountType);
  } else if (
    coupon.discountType === "percentage" &&
    Number(coupon.amount) > 100
  ) {
    throw badRequest("Percentage discount cannot exceed 100.");
  }

  if (hasField(source, "minimumOrder")) {
    coupon.minimumOrder = readNumber(source.minimumOrder, "Minimum order", {
      min: 0,
      max: 10000000,
    });
  }

  if (hasField(source, "expiresAt")) {
    coupon.expiresAt = readDate(source.expiresAt, "Expiry date");
  }

  if (hasField(source, "usageLimit")) {
    const usageLimit = readUsageLimit(source.usageLimit);

    if (usageLimit !== null && usageLimit < coupon.usedCount) {
      throw badRequest(
        "Usage limit cannot be lower than the number of times this coupon has been used.",
      );
    }

    coupon.usageLimit = usageLimit;
  }

  if (hasField(source, "description")) {
    coupon.description = readText(source.description, "Description", {
      max: 200,
    });
  }

  if (hasField(source, "status")) {
    coupon.status = readEnum(source.status, "Status", COUPON_STATUSES, {
      required: true,
    });
  }

  await coupon.save();

  res.status(200).json({
    success: true,
    data: { coupon: serializeAdminCoupon(coupon) },
  });
};

export const deactivateAdminCoupon = async (req, res) => {
  const coupon = await findAdminCoupon(req.params.id);

  // Coupons are deactivated instead of deleted so order history can still
  // reference the code that was used.
  coupon.status = "inactive";
  await coupon.save();

  res.status(200).json({
    success: true,
    data: { coupon: serializeAdminCoupon(coupon) },
  });
};
