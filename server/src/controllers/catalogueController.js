import { Category, Product } from "../models/index.js";
import {
  escapeRegExp,
  parseCatalogueQuery,
} from "../utils/catalogueQuery.js";
import { notFound } from "../utils/httpError.js";
import {
  serializeCategory,
  serializeProduct,
} from "../utils/serializers.js";

const SORT_STAGES = {
  featured: { featured: -1, bestseller: -1, createdAt: -1, _id: 1 },
  "price-low": { price: 1, createdAt: -1, _id: 1 },
  "price-high": { price: -1, createdAt: -1, _id: 1 },
  rating: { rating: -1, reviewCount: -1, _id: 1 },
  newest: { createdAt: -1, _id: 1 },
};

const emptyPage = (query) => ({
  success: true,
  data: {
    products: [],
    pagination: {
      page: query.page,
      limit: query.limit,
      total: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  },
});

export const listCategories = async (req, res) => {
  const categories = await Category.find({ isActive: true })
    .sort({ name: 1, _id: 1 })
    .select("name slug description image");

  res.status(200).json({
    success: true,
    data: {
      categories: categories.map(serializeCategory),
    },
  });
};

export const listProducts = async (req, res) => {
  const query = parseCatalogueQuery(req.query);
  const filter = { status: "Active" };

  if (query.category) {
    const category = await Category.findOne({
      isActive: true,
      $or: [
        { slug: query.category.toLowerCase() },
        {
          name: {
            $regex: `^${escapeRegExp(query.category)}$`,
            $options: "i",
          },
        },
      ],
    }).select("_id");

    if (!category) return res.status(200).json(emptyPage(query));

    filter.category = category._id;
  } else {
    const categoryIds = await Category.distinct("_id", { isActive: true });

    if (categoryIds.length === 0) {
      return res.status(200).json(emptyPage(query));
    }

    filter.category = { $in: categoryIds };
  }

  if (query.search) {
    const pattern = new RegExp(escapeRegExp(query.search), "i");
    const matchingCategories = await Category.find({
      isActive: true,
      name: pattern,
    }).distinct("_id");
    const searchConditions = [
      { name: pattern },
      { description: pattern },
      { material: pattern },
      { badge: pattern },
    ];

    if (matchingCategories.length > 0) {
      searchConditions.push({ category: { $in: matchingCategories } });
    }

    filter.$or = searchConditions;
  }

  if (query.minPrice > 0 || query.maxPrice !== null) {
    filter.price = {};

    if (query.minPrice > 0) filter.price.$gte = query.minPrice;
    if (query.maxPrice !== null) filter.price.$lte = query.maxPrice;
  }

  if (query.featured !== undefined) filter.featured = query.featured;
  if (query.bestseller !== undefined) filter.bestseller = query.bestseller;

  const [total, products] = await Promise.all([
    Product.countDocuments(filter),
    Product.find(filter)
      .populate({ path: "category", select: "name slug" })
      .sort(SORT_STAGES[query.sort])
      .skip(query.skip)
      .limit(query.limit),
  ]);

  res.status(200).json({
    success: true,
    data: {
      products: products.map(serializeProduct),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
        hasNextPage: query.page * query.limit < total,
        hasPreviousPage: query.page > 1,
      },
    },
  });
};

export const getProductBySlug = async (req, res) => {
  const slug = String(req.params.slug || "").trim().toLowerCase();

  if (!slug || slug.length > 180) {
    throw notFound("Product not found.");
  }

  const product = await Product.findOne({
    slug,
    status: "Active",
  }).populate({
    path: "category",
    match: { isActive: true },
    select: "name slug",
  });

  if (!product || !product.category) {
    throw notFound("Product not found.");
  }

  res.status(200).json({
    success: true,
    data: {
      product: serializeProduct(product),
    },
  });
};
