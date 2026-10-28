import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

const PRODUCT_STATUSES = ["Active", "Draft"];

const productSchema = new Schema(
  {
    // Stable storefront identifier such as "NV-001"; kept so existing links keep working.
    productId: {
      type: String,
      required: [true, "Product ID is required."],
      unique: true,
      trim: true,
      maxlength: [40, "Product ID cannot exceed 40 characters."],
    },
    name: {
      type: String,
      required: [true, "Product name is required."],
      trim: true,
      maxlength: [160, "Product name cannot exceed 160 characters."],
    },
    slug: {
      type: String,
      required: [true, "Product slug is required."],
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: [180, "Product slug cannot exceed 180 characters."],
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Product category is required."],
      index: true,
    },
    price: {
      type: Number,
      required: [true, "Product price is required."],
      min: [0, "Product price cannot be negative."],
    },
    compareAtPrice: {
      type: Number,
      min: [0, "Compare-at price cannot be negative."],
      default: null,
    },
    image: {
      type: String,
      required: [true, "Product image is required."],
      trim: true,
      maxlength: [2048, "Product image URL is too long."],
    },
    images: {
      type: [String],
      default: [],
    },
    description: {
      type: String,
      required: [true, "Product description is required."],
      trim: true,
      maxlength: [4000, "Product description cannot exceed 4000 characters."],
    },
    material: {
      type: String,
      trim: true,
      maxlength: [200, "Product material cannot exceed 200 characters."],
      default: "",
    },
    rating: {
      type: Number,
      min: [0, "Rating cannot be below 0."],
      max: [5, "Rating cannot exceed 5."],
      default: 0,
    },
    reviewCount: {
      type: Number,
      min: [0, "Review count cannot be negative."],
      default: 0,
    },
    stock: {
      type: Number,
      required: [true, "Stock is required."],
      min: [0, "Stock cannot be negative."],
      default: 0,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    bestseller: {
      type: Boolean,
      default: false,
    },
    badge: {
      type: String,
      trim: true,
      maxlength: [80, "Badge cannot exceed 80 characters."],
      default: "",
    },
    sku: {
      type: String,
      required: [true, "SKU is required."],
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: [60, "SKU cannot exceed 60 characters."],
    },
    status: {
      type: String,
      enum: {
        values: PRODUCT_STATUSES,
        message: "Product status must be Active or Draft.",
      },
      default: "Active",
      index: true,
    },
    specifications: {
      type: Map,
      of: String,
      default: {},
    },
  },
  { timestamps: true },
);

productSchema.index({ status: 1, category: 1, price: 1 });
productSchema.index({ status: 1, featured: -1, createdAt: -1 });
productSchema.index({ name: "text", description: "text", material: "text" });

export const Product = models.Product || model("Product", productSchema);

export default Product;
