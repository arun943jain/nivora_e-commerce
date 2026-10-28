import mongoose from "mongoose";
import {
  connectDatabase,
  disconnectDatabase,
  isDatabaseConfigured,
} from "../config/db.js";
import { Category, Coupon, Product, User } from "../models/index.js";
import {
  sampleCategories,
  sampleCoupons,
  sampleProducts,
  sampleUsers,
} from "./sampleData.js";

// `--dry-run` validates the imported sample records without touching MongoDB.
const dryRun = process.argv.includes("--dry-run");

const validateSamples = async (Model, records, label, extraFields = {}) => {
  const problems = [];

  for (const [index, record] of records.entries()) {
    const document = new Model({ ...record, ...extraFields });

    try {
      await document.validate();
    } catch (error) {
      problems.push(
        `${label}[${index}] (${record.slug || record.email || record.code}): ${error.message}`,
      );
    }
  }

  if (problems.length > 0) {
    throw new Error(`Sample data validation failed.\n${problems.join("\n")}`);
  }
};

const validateAllSamples = async () => {
  // Products need a category reference to validate; a placeholder is fine here
  // because the real category IDs are resolved only when writing to MongoDB.
  const placeholderCategoryId = new mongoose.Types.ObjectId();
  const productsWithCategory = sampleProducts.map(
    ({ categoryName, ...product }) => ({
      ...product,
      category: placeholderCategoryId,
    }),
  );

  await validateSamples(Category, sampleCategories, "categories");
  await validateSamples(Product, productsWithCategory, "products");
  await validateSamples(User, sampleUsers, "users");
  await validateSamples(Coupon, sampleCoupons, "coupons");
};

const summarize = (label, result) => {
  const created = result.upsertedCount || 0;
  const existing = result.matchedCount || 0;
  console.log(
    `[seed] ${label}: ${created} created, ${existing} already existed.`,
  );
};

const seedCategories = async () => {
  const result = await Category.bulkWrite(
    sampleCategories.map((category) => ({
      updateOne: {
        filter: { slug: category.slug },
        update: { $setOnInsert: category },
        upsert: true,
      },
    })),
  );

  summarize("categories", result);

  const categories = await Category.find({
    slug: { $in: sampleCategories.map((category) => category.slug) },
  }).select("_id slug");

  return new Map(categories.map((category) => [category.slug, category._id]));
};

const seedProducts = async (categoryIds) => {
  const records = sampleProducts.map(({ categoryName, ...product }) => {
    const categoryId = categoryIds.get(
      sampleCategories.find((category) => category.name === categoryName)?.slug,
    );

    if (!categoryId) {
      throw new Error(
        `Category "${categoryName}" could not be resolved for product "${product.slug}".`,
      );
    }

    return { ...product, category: categoryId };
  });

  await validateSamples(Product, records, "products");

  const result = await Product.bulkWrite(
    records.map((product) => ({
      updateOne: {
        filter: { slug: product.slug },
        update: { $setOnInsert: product },
        upsert: true,
      },
    })),
  );

  summarize("products", result);
};

const seedUsers = async () => {
  const result = await User.bulkWrite(
    sampleUsers.map((user) => ({
      updateOne: {
        filter: { email: user.email },
        // Never $set passwordHash: seeded users are directory records only.
        update: { $setOnInsert: user },
        upsert: true,
      },
    })),
  );

  summarize("users", result);
};

const seedCoupons = async () => {
  const result = await Coupon.bulkWrite(
    sampleCoupons.map((coupon) => ({
      updateOne: {
        filter: { code: coupon.code },
        update: { $setOnInsert: coupon },
        upsert: true,
      },
    })),
  );

  summarize("coupons", result);
};

const main = async () => {
  await validateAllSamples();

  if (dryRun) {
    console.log(
      `[seed] Dry run passed: ${sampleCategories.length} categories, ${sampleProducts.length} products, ${sampleUsers.length} users, ${sampleCoupons.length} coupons are valid.`,
    );
    console.log("[seed] No database connection was made.");
    return;
  }

  if (!isDatabaseConfigured()) {
    throw new Error(
      "MONGODB_URI is not configured. Copy server/.env.example to server/.env, set a real URI, then run the seed again.",
    );
  }

  const connection = await connectDatabase();
  if (!connection.connected) {
    throw new Error("MongoDB is not connected; seed aborted.");
  }

  await Promise.all([
    Category.init(),
    Product.init(),
    User.init(),
    Coupon.init(),
  ]);

  const categoryIds = await seedCategories();
  await seedProducts(categoryIds);
  await seedUsers();
  await seedCoupons();

  console.log(
    "[seed] Done. Existing records were not updated or deleted; sample orders were skipped.",
  );
};

main()
  .catch((error) => {
    console.error(`[seed] ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
