import {
  MAX_CART_ITEMS,
  MAX_CART_QUANTITY,
  Product,
} from "../models/index.js";
import {
  buildCartPayload,
  resolveCoupon,
} from "../utils/cartPricing.js";
import { getOrCreateCart, loadCartLines } from "../utils/cartData.js";
import { badRequest, conflict, notFound } from "../utils/httpError.js";

const parseProductId = (value) => {
  const productId = String(value || "").trim();

  if (!productId || productId.length > 40) {
    throw badRequest("A valid product ID is required.");
  }

  return productId;
};

const parseQuantity = (value, fallback) => {
  const raw = value === undefined || value === null ? fallback : value;
  const quantity = Number(raw);

  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > MAX_CART_QUANTITY
  ) {
    throw badRequest(
      `Quantity must be a whole number between 1 and ${MAX_CART_QUANTITY}.`,
    );
  }

  return quantity;
};

const findProduct = async (productId, { session } = {}) => {
  const query = Product.findOne({ productId, status: "Active" });
  if (session) query.session(session);
  return query;
};

const findCartItem = (cart, product) =>
  cart.items.find(
    (item) =>
      item.productId === product.productId ||
      String(item.product) === String(product._id),
  );

const respondWithCart = async (
  res,
  cart,
  { removeStale = false, coupon = null, issues = [] } = {},
) => {
  const { lines } = await loadCartLines(cart, { removeStale });
  const response = {
    success: true,
    data: {
      cart: buildCartPayload(lines, { coupon }),
    },
  };

  if (issues.length > 0) {
    response.data.issues = issues;
  }

  res.status(200).json(response);
};

export const getCart = async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);

  await respondWithCart(res, cart, { removeStale: true });
};

export const addCartItem = async (req, res) => {
  const productId = parseProductId(req.body?.productId);
  const quantity = parseQuantity(req.body?.quantity, 1);
  const cart = await getOrCreateCart(req.user._id);
  const product = await findProduct(productId);

  if (!product) {
    throw notFound("Product not found.");
  }

  if (product.stock < 1) {
    throw conflict("This product is currently out of stock.");
  }

  const existing = findCartItem(cart, product);
  const nextQuantity = (existing?.quantity || 0) + quantity;

  if (nextQuantity > MAX_CART_QUANTITY) {
    throw badRequest(
      `You can add up to ${MAX_CART_QUANTITY} of one product.`,
    );
  }

  if (nextQuantity > product.stock) {
    throw conflict(
      `Only ${product.stock} of ${product.name} ${
        product.stock === 1 ? "is" : "are"
      } available.`,
    );
  }

  if (existing) {
    existing.quantity = nextQuantity;
    existing.product = product._id;
    existing.productId = product.productId;
  } else {
    if (cart.items.length >= MAX_CART_ITEMS) {
      throw badRequest(
        `Your cart can hold up to ${MAX_CART_ITEMS} different products.`,
      );
    }

    cart.items.push({
      product: product._id,
      productId: product.productId,
      quantity,
    });
  }

  await cart.save();

  await respondWithCart(res, cart);
};

export const updateCartItem = async (req, res) => {
  const productId = parseProductId(req.params.productId);
  const quantity = parseQuantity(req.body?.quantity);
  const cart = await getOrCreateCart(req.user._id);
  const product = await findProduct(productId);

  if (!product) {
    throw notFound("Product not found.");
  }

  const existing = findCartItem(cart, product);

  if (!existing) {
    throw notFound("That product is not in your cart.");
  }

  if (quantity > product.stock) {
    throw conflict(
      `Only ${product.stock} of ${product.name} ${
        product.stock === 1 ? "is" : "are"
      } available.`,
    );
  }

  existing.quantity = quantity;
  existing.product = product._id;
  existing.productId = product.productId;
  await cart.save();

  await respondWithCart(res, cart);
};

export const removeCartItem = async (req, res) => {
  const productId = parseProductId(req.params.productId);
  const cart = await getOrCreateCart(req.user._id);

  cart.items = cart.items.filter((item) => item.productId !== productId);
  await cart.save();

  await respondWithCart(res, cart);
};

export const clearCart = async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);

  cart.items = [];
  await cart.save();

  await respondWithCart(res, cart);
};

export const mergeGuestCart = async (req, res) => {
  const rawItems = req.body?.items;

  if (!Array.isArray(rawItems)) {
    throw badRequest("Cart items must be an array.");
  }

  if (rawItems.length > MAX_CART_ITEMS) {
    throw badRequest(
      `Your cart can hold up to ${MAX_CART_ITEMS} different products.`,
    );
  }

  const requestedByProductId = new Map();
  const issues = new Set();

  for (const rawItem of rawItems) {
    const productId =
      typeof rawItem?.productId === "string"
        ? rawItem.productId.trim()
        : "";
    const quantity = Number(rawItem?.quantity);

    if (
      !productId ||
      productId.length > 40 ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_CART_QUANTITY
    ) {
      issues.add("Some guest bag items were skipped because they were invalid.");
      continue;
    }

    requestedByProductId.set(
      productId,
      Math.min(
        MAX_CART_QUANTITY,
        (requestedByProductId.get(productId) || 0) + quantity,
      ),
    );
  }

  const cart = await getOrCreateCart(req.user._id);
  const products = await Product.find({
    productId: { $in: [...requestedByProductId.keys()] },
    status: "Active",
  });
  const productsByProductId = new Map(
    products.map((product) => [product.productId, product]),
  );
  let changed = false;

  for (const [productId, requestedQuantity] of requestedByProductId) {
    const product = productsByProductId.get(productId);

    if (!product) {
      issues.add(`${productId} is no longer available.`);
      continue;
    }

    if (product.stock < 1) {
      issues.add(`${product.name} is currently out of stock.`);
      continue;
    }

    const existing = findCartItem(cart, product);
    const currentQuantity = existing?.quantity || 0;
    const nextQuantity = Math.min(
      product.stock,
      MAX_CART_QUANTITY,
      currentQuantity + requestedQuantity,
    );

    if (nextQuantity <= currentQuantity) {
      issues.add(
        `Only ${product.stock} of ${product.name} ${
          product.stock === 1 ? "is" : "are"
        } available.`,
      );
      continue;
    }

    if (!existing) {
      if (cart.items.length >= MAX_CART_ITEMS) {
        issues.add(
          `Your cart can hold up to ${MAX_CART_ITEMS} different products.`,
        );
        break;
      }

      cart.items.push({
        product: product._id,
        productId: product.productId,
        quantity: nextQuantity,
      });
    } else {
      existing.quantity = nextQuantity;
      existing.product = product._id;
      existing.productId = product.productId;
    }

    changed = true;
  }

  if (changed) {
    await cart.save();
  }

  await respondWithCart(res, cart, { issues: [...issues] });
};

export const quoteCart = async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  const { lines } = await loadCartLines(cart, { removeStale: true });

  if (lines.length === 0) {
    throw badRequest("Your cart is empty.");
  }

  const subtotal = lines.reduce(
    (total, line) => total + line.product.price * line.quantity,
    0,
  );
  const coupon = await resolveCoupon(req.body?.couponCode, subtotal);

  await respondWithCart(res, cart, { coupon });
};
