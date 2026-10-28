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

export const serializeUser = (user) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  role: user.role,
  status: user.status,
  createdAt: user.createdAt,
});

const serializeAddress = (address) =>
  address
    ? {
        firstName: address.firstName,
        lastName: address.lastName,
        address: address.address,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: address.country,
      }
    : null;

export const serializeOrder = (order) => {
  const shippingAddress = serializeAddress(order.shippingAddress);

  return {
    id: order.orderNumber,
    orderNumber: order.orderNumber,
    customer: order.customer?.name || "",
    customerDetails: {
      name: order.customer?.name || "",
      email: order.customer?.email || "",
      phone: order.customer?.phone || "",
    },
    email: order.customer?.email || "",
    phone: order.customer?.phone || "",
    items: (order.items || []).map((item) => ({
      id: item.productId || String(item.product || ""),
      productId: item.productId || "",
      sku: item.sku || "",
      name: item.name,
      image: item.image || "",
      price: item.price,
      qty: item.quantity,
      quantity: item.quantity,
      lineTotal: item.price * item.quantity,
    })),
    address: shippingAddress,
    shippingAddress,
    subtotal: order.subtotal,
    discount: order.discount || 0,
    shipping: order.shipping || 0,
    total: order.total,
    couponCode: order.couponCode || "",
    payment: order.paymentMethod || "Cash on delivery",
    paymentMethod: order.paymentMethod || "Cash on delivery",
    paymentStatus: order.paymentStatus || "Pending",
    status: order.status || "Pending",
    notes: order.notes || "",
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
};
