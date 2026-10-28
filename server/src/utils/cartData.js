import { Cart, Product } from "../models/index.js";

export const getOrCreateCart = async (userId) => {
  try {
    return await Cart.findOneAndUpdate(
      { user: userId },
      { $setOnInsert: { user: userId, items: [] } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  } catch (error) {
    // Two simultaneous first requests can race on the unique user index.
    if (error?.code === 11000) {
      return Cart.findOne({ user: userId });
    }

    throw error;
  }
};

export const loadCartLines = async (
  cart,
  { session, removeStale = false } = {},
) => {
  const productIds = cart.items.map((item) => item.product);
  const query = Product.find({ _id: { $in: productIds } });
  if (session) query.session(session);
  const products = await query;
  const productsById = new Map(
    products.map((product) => [String(product._id), product]),
  );

  const lines = [];
  const keptItems = [];
  let staleCount = 0;

  for (const item of cart.items) {
    const product = productsById.get(String(item.product));

    if (!product || product.status !== "Active") {
      staleCount += 1;
      continue;
    }

    keptItems.push(item);
    lines.push({ product, quantity: item.quantity });
  }

  if (removeStale && staleCount > 0) {
    cart.items = keptItems;
    await cart.save({ session });
  }

  return { lines, staleCount };
};
