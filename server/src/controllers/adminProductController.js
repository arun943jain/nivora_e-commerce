import mongoose from "mongoose";
import { Category, Product } from "../models/index.js";
import {
  badRequest,
  conflict,
  notFound,
} from "../utils/httpError.js";
import {
  hasField,
  parseAdminListQuery,
  readBoolean,
  readEnum,
  readImageUrl,
  readNumber,
  readText,
  searchPattern,
} from "../utils/adminQuery.js";
import { escapeRegExp } from "../utils/catalogueQuery.js";
import { slugify } from "../utils/validators.js";
import { serializeAdminProduct } from "../utils/serializers.js";

const PRODUCT_STATUSES = ["Active", "Draft"];
const MAX_PRODUCT_PRICE = 10000000;
const MAX_PRODUCT_STOCK = 1000000;
const MAX_IMAGES = 10;
const MAX_SPECIFICATIONS = 40;

const findAdminProduct = async (id) => {
  const text = String(id || "").trim();

  if (!text || text.length > 60) {
    throw notFound("Product not found.");
  }

  return Product.findOne(
    mongoose.isValidObjectId(text)
      ? { $or: [{ _id: text }, { productId: text }] }
      : { productId: text },
  );
};

const resolveCategory = async (value) => {
  const text = readText(value, "Category", { required: true, max: 80 });
  const filters = [
    { name: { $regex: `^${escapeRegExp(text)}$`, $options: "i" } },
    { slug: text.toLowerCase() },
  ];

  if (mongoose.isValidObjectId(text)) {
    filters.unshift({ _id: text });
  }

  const category = await Category.findOne({
    isActive: true,
    $or: filters,
  });

  if (!category) {
    throw badRequest("Choose an active category.");
  }

  return category;
};

const normalizeSlug = (value) => {
  const slug = readText(value, "Slug", { required: true, max: 180 })
    .toLowerCase();

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw badRequest("Slug can only contain lowercase letters, numbers and hyphens.");
  }

  return slug;
};

const normalizeSku = (value) => {
  const sku = readText(value, "SKU", { required: true, max: 60 }).toUpperCase();

  if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(sku)) {
    throw badRequest(
      "SKU can only contain letters, numbers, dots, underscores and hyphens.",
    );
  }

  return sku;
};

const ensureUniqueField = async (field, value, excludeId) => {
  const filter = { [field]: value };

  if (excludeId) {
    filter._id = { $ne: excludeId };
  }

  if (await Product.exists(filter)) {
    throw conflict(`A product with that ${field} already exists.`);
  }
};

const uniqueDerivedSlug = async (name) => {
  const base = slugify(name);

  if (!base) {
    throw badRequest("Product name must contain letters or numbers.");
  }

  let slug = base;
  let suffix = 2;

  while (await Product.exists({ slug })) {
    slug = `${base}-${suffix}`;
    suffix += 1;

    if (suffix > 100) {
      throw conflict("Could not generate a unique product slug.");
    }
  }

  return slug;
};

const generateProductId = async () => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `NV-${Date.now().toString(36).toUpperCase()}${Math.floor(
      Math.random() * 1000,
    )
      .toString()
      .padStart(3, "0")}`;

    if (!(await Product.exists({ productId: candidate }))) {
      return candidate;
    }
  }

  throw conflict("Could not generate a unique product ID. Please try again.");
};

const readImages = (value, fallback) => {
  if (value === undefined || value === null) return fallback;

  if (!Array.isArray(value)) {
    throw badRequest("Images must be an array.");
  }

  if (value.length > MAX_IMAGES) {
    throw badRequest(`A product can have at most ${MAX_IMAGES} images.`);
  }

  return Array.from(
    new Set(value.map((item, index) => readImageUrl(item, `Image ${index + 1}`))),
  ).filter(Boolean);
};

const readSpecifications = (value, fallback) => {
  if (value === undefined || value === null) return fallback;

  if (typeof value !== "object" || Array.isArray(value)) {
    throw badRequest("Specifications must be an object.");
  }

  const entries = Object.entries(value);

  if (entries.length > MAX_SPECIFICATIONS) {
    throw badRequest(
      `A product can have at most ${MAX_SPECIFICATIONS} specifications.`,
    );
  }

  return Object.fromEntries(
    entries.map(([key, specification]) => [
      readText(key, "Specification name", { required: true, max: 60 }),
      readText(String(specification ?? ""), `Specification ${key}`, {
        max: 200,
      }),
    ]),
  );
};

const readPriceFields = (source, existing) => {
  const hasPrice = hasField(source, "price");
  const hasCompareAt = hasField(source, "compareAtPrice");
  const price = hasPrice
    ? readNumber(source.price, "Price", {
        required: true,
        min: 0,
        max: MAX_PRODUCT_PRICE,
      })
    : existing?.price ?? 0;
  const compareAtPrice = hasCompareAt
    ? readNumber(source.compareAtPrice, "Compare-at price", {
        allowNull: true,
        min: 0,
        max: MAX_PRODUCT_PRICE,
      })
    : existing?.compareAtPrice ?? null;

  if (compareAtPrice !== null && compareAtPrice < price) {
    throw badRequest("Compare-at price cannot be less than the price.");
  }

  return { price, compareAtPrice };
};

const populateProduct = async (product) => {
  await product.populate({ path: "category", select: "name slug" });
  return product;
};

export const listAdminProducts = async (req, res) => {
  const query = parseAdminListQuery(req.query, {
    sortable: {
      name: "name",
      category: "category.name",
      price: "price",
      stock: "stock",
      status: "status",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
    defaultSort: "createdAt",
    statuses: PRODUCT_STATUSES,
  });
  const filter = {};

  if (query.status) {
    filter.status = query.status;
  }

  if (query.search) {
    const pattern = searchPattern(query.search);
    filter.$or = [
      { name: pattern },
      { sku: pattern },
      { slug: pattern },
      { description: pattern },
      { material: pattern },
    ];
  }

  const mongoSort =
    query.sort === "category.name"
      ? { createdAt: -1, _id: -1 }
      : { [query.sort]: query.direction, _id: query.direction };
  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate({ path: "category", select: "name slug" })
      .sort(mongoSort)
      .limit(500),
    Product.countDocuments(filter),
  ]);

  if (query.sort === "category.name") {
    products.sort(
      (left, right) =>
        query.direction *
        String(left.category?.name || "").localeCompare(
          String(right.category?.name || ""),
        ),
    );
  }

  res.status(200).json({
    success: true,
    data: {
      products: products.map(serializeAdminProduct),
      total,
    },
  });
};

export const createAdminProduct = async (req, res) => {
  const source = req.body || {};
  const name = readText(source.name, "Product name", {
    required: true,
    max: 160,
  });
  const description = readText(source.description, "Description", {
    required: true,
    max: 4000,
  });
  const material = readText(source.material, "Material", { max: 200 });
  const badge = readText(source.badge, "Badge", { max: 80 });
  const sku = normalizeSku(source.sku);
  const image = readImageUrl(source.image, "Image URL", { required: true });
  const category = await resolveCategory(source.category);

  if (!hasField(source, "price")) {
    throw badRequest("Price is required.");
  }

  const { price, compareAtPrice } = readPriceFields(source);
  const stock = readNumber(source.stock, "Stock", {
    required: true,
    integer: true,
    min: 0,
    max: MAX_PRODUCT_STOCK,
  });
  const status = readEnum(source.status, "Status", PRODUCT_STATUSES, {
    fallback: "Active",
  });
  const slug = hasField(source, "slug")
    ? normalizeSlug(source.slug)
    : await uniqueDerivedSlug(name);

  await Promise.all([ensureUniqueField("slug", slug), ensureUniqueField("sku", sku)]);

  const product = new Product({
    productId: await generateProductId(),
    name,
    slug,
    category: category._id,
    price,
    compareAtPrice,
    image,
    images: readImages(source.images, [image]),
    description,
    material,
    rating:
      source.rating === undefined
        ? 0
        : readNumber(source.rating, "Rating", { min: 0, max: 5 }),
    reviewCount:
      source.reviewCount === undefined
        ? 0
        : readNumber(source.reviewCount, "Review count", {
            integer: true,
            min: 0,
            max: 1000000,
          }),
    stock,
    featured: readBoolean(source.featured, "Featured", false),
    bestseller: readBoolean(source.bestseller, "Bestseller", false),
    badge,
    sku,
    status,
    specifications: readSpecifications(source.specifications, {}),
  });

  await product.save();
  await populateProduct(product);

  res.status(201).json({
    success: true,
    data: { product: serializeAdminProduct(product) },
  });
};

export const updateAdminProduct = async (req, res) => {
  const source = req.body || {};
  const product = await findAdminProduct(req.params.id);

  if (!product) {
    throw notFound("Product not found.");
  }

  if (hasField(source, "name")) {
    product.name = readText(source.name, "Product name", {
      required: true,
      max: 160,
    });
  }

  if (hasField(source, "slug")) {
    const slug = normalizeSlug(source.slug);
    await ensureUniqueField("slug", slug, product._id);
    product.slug = slug;
  }

  if (hasField(source, "sku")) {
    const sku = normalizeSku(source.sku);
    await ensureUniqueField("sku", sku, product._id);
    product.sku = sku;
  }

  if (hasField(source, "category")) {
    const category = await resolveCategory(source.category);
    product.category = category._id;
  }

  if (hasField(source, "price") || hasField(source, "compareAtPrice")) {
    const { price, compareAtPrice } = readPriceFields(source, product);
    product.price = price;
    product.compareAtPrice = compareAtPrice;
  }

  if (hasField(source, "stock")) {
    product.stock = readNumber(source.stock, "Stock", {
      required: true,
      integer: true,
      min: 0,
      max: MAX_PRODUCT_STOCK,
    });
  }

  if (hasField(source, "image")) {
    const image = readImageUrl(source.image, "Image URL", { required: true });

    if (image !== product.image) {
      product.image = image;

      if (!hasField(source, "images")) {
        product.images = [image];
      }
    }
  }

  if (hasField(source, "images")) {
    product.images = readImages(source.images, product.images);
  }

  if (hasField(source, "description")) {
    product.description = readText(source.description, "Description", {
      required: true,
      max: 4000,
    });
  }

  if (hasField(source, "material")) {
    product.material = readText(source.material, "Material", { max: 200 });
  }

  if (hasField(source, "badge")) {
    product.badge = readText(source.badge, "Badge", { max: 80 });
  }

  if (hasField(source, "featured")) {
    product.featured = readBoolean(source.featured, "Featured");
  }

  if (hasField(source, "bestseller")) {
    product.bestseller = readBoolean(source.bestseller, "Bestseller");
  }

  if (hasField(source, "status")) {
    product.status = readEnum(source.status, "Status", PRODUCT_STATUSES, {
      required: true,
    });
  }

  if (hasField(source, "specifications")) {
    product.specifications = readSpecifications(source.specifications, {});
  }

  await product.save();
  await populateProduct(product);

  res.status(200).json({
    success: true,
    data: { product: serializeAdminProduct(product) },
  });
};

export const deactivateAdminProduct = async (req, res) => {
  const product = await findAdminProduct(req.params.id);

  if (!product) {
    throw notFound("Product not found.");
  }

  // Products are archived instead of deleted so historical order snapshots
  // and references remain intact.
  product.status = "Draft";
  await product.save();
  await populateProduct(product);

  res.status(200).json({
    success: true,
    data: { product: serializeAdminProduct(product) },
  });
};
