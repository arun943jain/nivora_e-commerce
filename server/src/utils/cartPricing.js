import { Coupon } from "../models/index.js";
import { badRequest } from "./httpError.js";

export const FREE_SHIPPING_THRESHOLD = 2500;
export const SHIPPING_FEE = 150;

export const normalizeCouponCode = (value) =>
  String(value || "").trim().toUpperCase();

export const calculateShipping = (subtotal) =>
  subtotal > 0 && subtotal < FREE_SHIPPING_THRESHOLD ? SHIPPING_FEE : 0;

export const calculateCouponDiscount = (coupon, subtotal) => {
  if (!coupon || subtotal <= 0) return 0;

  const rawDiscount =
    coupon.discountType === "percentage"
      ? (subtotal * coupon.amount) / 100
      : coupon.amount;

  return Math.max(0, Math.min(subtotal, Math.round(rawDiscount)));
};

export const resolveCoupon = async (code, subtotal, { session } = {}) => {
  const normalized = normalizeCouponCode(code);

  if (!normalized) return null;

  if (normalized.length > 40) {
    throw badRequest("Coupon code cannot exceed 40 characters.");
  }

  const query = Coupon.findOne({ code: normalized });
  if (session) query.session(session);
  const coupon = await query;

  if (!coupon) {
    throw badRequest("That coupon code is not valid.");
  }

  if (coupon.status !== "active") {
    throw badRequest("That coupon is no longer active.");
  }

  if (coupon.expiresAt && coupon.expiresAt.getTime() <= Date.now()) {
    throw badRequest("That coupon has expired.");
  }

  if (subtotal < coupon.minimumOrder) {
    throw badRequest(
      `That coupon requires a minimum order of ₹${Number(
        coupon.minimumOrder,
      ).toLocaleString("en-IN")}.`,
    );
  }

  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    throw badRequest("That coupon has reached its usage limit.");
  }

  return coupon;
};

const serializeCouponSummary = (coupon) => ({
  code: coupon.code,
  description: coupon.description || "",
  discountType: coupon.discountType,
  amount: coupon.amount,
  minimumOrder: coupon.minimumOrder,
  expiresAt: coupon.expiresAt,
});

export const buildCartPayload = (lines, { coupon = null } = {}) => {
  const items = lines.map(({ product, quantity }) => ({
    id: product.productId,
    productId: product.productId,
    sku: product.sku,
    name: product.name,
    slug: product.slug,
    price: product.price,
    image: product.image,
    material: product.material || "",
    stock: product.stock,
    qty: quantity,
    quantity,
    lineTotal: product.price * quantity,
  }));
  const subtotal = items.reduce((total, item) => total + item.lineTotal, 0);
  const discount = calculateCouponDiscount(coupon, subtotal);
  const shipping = calculateShipping(subtotal);
  const total = Math.max(0, subtotal - discount + shipping);

  return {
    items,
    itemCount: items.reduce((count, item) => count + item.qty, 0),
    subtotal,
    discount,
    shipping,
    total,
    couponCode: coupon?.code || "",
    coupon: coupon ? serializeCouponSummary(coupon) : null,
  };
};
