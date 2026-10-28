import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

export const MAX_CART_ITEMS = 50;
export const MAX_CART_QUANTITY = 99;

const cartItemSchema = new Schema(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Cart item product is required."],
    },
    // Stable storefront identifier so cart API paths can use productId.
    productId: {
      type: String,
      required: [true, "Cart item product ID is required."],
      trim: true,
      maxlength: [40, "Cart item product ID cannot exceed 40 characters."],
    },
    quantity: {
      type: Number,
      required: [true, "Cart item quantity is required."],
      min: [1, "Cart item quantity must be at least 1."],
      max: [MAX_CART_QUANTITY, "Cart item quantity is too large."],
      validate: {
        validator: Number.isInteger,
        message: "Cart item quantity must be a whole number.",
      },
    },
  },
  { _id: false },
);

const cartSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Cart user is required."],
      unique: true,
      index: true,
    },
    items: {
      type: [cartItemSchema],
      default: [],
    },
  },
  { timestamps: true },
);

cartSchema.index({ updatedAt: -1 });

export const Cart = models.Cart || model("Cart", cartSchema);

export default Cart;
