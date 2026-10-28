import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

const reviewSchema = new Schema(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Review product is required."],
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    // Author name snapshot; guest reviews are allowed until authentication exists.
    author: {
      type: String,
      required: [true, "Review author is required."],
      trim: true,
      maxlength: [120, "Review author cannot exceed 120 characters."],
    },
    rating: {
      type: Number,
      required: [true, "Rating is required."],
      min: [1, "Rating must be between 1 and 5."],
      max: [5, "Rating must be between 1 and 5."],
      validate: {
        validator: Number.isInteger,
        message: "Rating must be a whole number.",
      },
    },
    note: {
      type: String,
      required: [true, "Review text is required."],
      trim: true,
      minlength: [10, "Review text must be at least 10 characters."],
      maxlength: [1000, "Review text cannot exceed 1000 characters."],
    },
    isVisible: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

reviewSchema.index({ product: 1, createdAt: -1 });
reviewSchema.index({ product: 1, isVisible: 1, createdAt: -1 });
reviewSchema.index({ user: 1, createdAt: -1 });

export const Review = models.Review || model("Review", reviewSchema);

export default Review;
