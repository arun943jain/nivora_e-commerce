import {
  categories as frontendCategories,
  coupons as frontendCoupons,
  products as frontendProducts,
  users as frontendUsers,
} from "../../../client/Jobaaj-Store/src/data/store.js";
import { normalizeEmail, slugify } from "../utils/validators.js";

// Reuse the storefront's sample catalogue so seeded records keep the exact
// names, slugs, IDs, prices, stock levels, and image URLs the UI already uses.
export const sampleCategories = frontendCategories.map((category) => ({
  name: category.name,
  slug: slugify(category.name),
  image: category.image,
  isActive: true,
}));

export const sampleProducts = frontendProducts.map((product) => ({
  productId: product.id,
  name: product.name,
  slug: product.slug,
  categoryName: product.category,
  price: product.price,
  compareAtPrice: product.compareAtPrice ?? null,
  image: product.image,
  images: Array.from(
    new Set([product.image, ...(product.images || [])].filter(Boolean)),
  ),
  description: product.description,
  material: product.material,
  rating: product.rating,
  reviewCount: product.reviewCount,
  stock: product.stock,
  featured: Boolean(product.featured),
  bestseller: Boolean(product.bestseller),
  badge: product.badge || "",
  sku: product.sku,
  status: product.status === "Draft" ? "Draft" : "Active",
  specifications: Object.fromEntries(
    Object.entries(product.specifications || {}).map(([key, value]) => [
      key,
      String(value),
    ]),
  ),
}));

const parseDisplayDate = (value) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

// Directory records only: no passwords or password hashes are seeded.
export const sampleUsers = frontendUsers.map((user) => ({
  name: user.name,
  email: normalizeEmail(user.email),
  role: user.role === "Admin" ? "admin" : "customer",
  status: user.status === "Suspended" ? "suspended" : "active",
  joinedAt: parseDisplayDate(user.joined) || new Date(),
}));

export const sampleCoupons = frontendCoupons.map((coupon) => {
  const numericValue =
    Number.parseFloat(String(coupon.value).replace(/[^\d.]/g, "")) || 0;
  const discountType =
    coupon.type === "Percentage" ? "percentage" : "fixed";

  return {
    code: String(coupon.code).trim().toUpperCase(),
    description: `${coupon.type} campaign imported from sample data`,
    discountType,
    amount:
      discountType === "percentage"
        ? Math.min(100, numericValue)
        : numericValue,
    minimumOrder: Number(coupon.minimum) || 0,
    expiresAt: parseDisplayDate(coupon.expiry),
    status: coupon.status === "Active" ? "active" : "inactive",
  };
});

// The storefront sample orders are intentionally not seeded: their totals do not
// match their line items, and they contain no customer email or shipping address.
// Real orders can still be created later through the Order model.
