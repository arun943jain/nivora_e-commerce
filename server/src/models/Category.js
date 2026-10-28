import mongoose from "mongoose";
import { slugify } from "../utils/validators.js";

const { Schema, model, models } = mongoose;

const categorySchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required."],
      trim: true,
      maxlength: [80, "Category name cannot exceed 80 characters."],
    },
    slug: {
      type: String,
      required: [true, "Category slug is required."],
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: [80, "Category slug cannot exceed 80 characters."],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Category description cannot exceed 500 characters."],
      default: "",
    },
    image: {
      type: String,
      trim: true,
      maxlength: [2048, "Category image URL is too long."],
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

categorySchema.pre("validate", function setSlug() {
  if (!this.slug && this.name) {
    this.slug = slugify(this.name);
  }
});

categorySchema.index({ isActive: 1, name: 1 });

export const Category =
  models.Category || model("Category", categorySchema);

export default Category;
