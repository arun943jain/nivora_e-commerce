export const serializeCategory = (category) => ({
  id: String(category._id),
  name: category.name,
  slug: category.slug,
  description: category.description || "",
  image: category.image || "",
});

export const serializeProduct = (product) => {
  const specificationSource = product.specifications;
  const specificationEntries =
    specificationSource instanceof Map
      ? [...specificationSource.entries()]
      : Object.entries(specificationSource || {});
  const specifications = Object.fromEntries(
    specificationEntries.map(([key, value]) => [key, String(value)]),
  );
  const category = product.category;

  return {
    id: product.productId,
    name: product.name,
    slug: product.slug,
    category: category?.name || "",
    categorySlug: category?.slug || "",
    price: product.price,
    compareAtPrice: product.compareAtPrice ?? null,
    image: product.image,
    images: Array.from(
      new Set([product.image, ...(product.images || [])].filter(Boolean)),
    ),
    description: product.description,
    material: product.material || "",
    rating: product.rating,
    reviewCount: product.reviewCount,
    stock: product.stock,
    featured: Boolean(product.featured),
    bestseller: Boolean(product.bestseller),
    badge: product.badge || "",
    sku: product.sku,
    status: product.status,
    specifications,
  };
};
