import {
  Category,
  Coupon,
  Order,
  Product,
  User,
} from "../models/index.js";
import { badRequest } from "../utils/httpError.js";

const ORDER_STATUSES = [
  "Pending",
  "Preparing",
  "Shipped",
  "Delivered",
  "Cancelled",
];
const DASHBOARD_RANGES = new Set([
  "this-month",
  "last-month",
  "last-90-days",
  "all",
]);

const parseRange = (value) => {
  const range = String(value || "this-month").trim().toLowerCase();

  if (!DASHBOARD_RANGES.has(range)) {
    throw badRequest(
      "range must be one of: this-month, last-month, last-90-days, all.",
    );
  }

  return range;
};

const rangeFilter = (range) => {
  const now = new Date();

  if (range === "all") {
    return {};
  }

  if (range === "last-90-days") {
    return { createdAt: { $gte: new Date(now.getTime() - 90 * 86400000) } };
  }

  const startOfMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );

  if (range === "this-month") {
    return { createdAt: { $gte: startOfMonth } };
  }

  const startOfLastMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );

  return {
    createdAt: { $gte: startOfLastMonth, $lt: startOfMonth },
  };
};

const startOfUtcDay = (date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const buildDailyActivity = (rows) => {
  const counts = new Map(rows.map((row) => [row._id, row.count]));
  const today = startOfUtcDay(new Date());
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today.getTime() - (6 - index) * 86400000);
    const key = date.toISOString().slice(0, 10);

    return {
      date: key,
      label: labels[date.getUTCDay()],
      count: counts.get(key) || 0,
    };
  });
};

export const getAdminDashboard = async (req, res) => {
  const range = parseRange(req.query.range);
  const orderRange = rangeFilter(range);
  const sevenDaysAgo = new Date(
    startOfUtcDay(new Date()).getTime() - 6 * 86400000,
  );

  const [
    productTotal,
    productActive,
    productDraft,
    categoryTotal,
    userTotal,
    userActive,
    userSuspended,
    adminTotal,
    couponTotal,
    couponActive,
    couponInactive,
    orderTotal,
    salesTotals,
    statusRows,
    recentOrders,
    dailyRows,
    topProducts,
  ] = await Promise.all([
    Product.countDocuments({}),
    Product.countDocuments({ status: "Active" }),
    Product.countDocuments({ status: "Draft" }),
    Category.countDocuments({ isActive: true }),
    User.countDocuments({}),
    User.countDocuments({ status: "active" }),
    User.countDocuments({ status: "suspended" }),
    User.countDocuments({ role: "admin", status: "active" }),
    Coupon.countDocuments({}),
    Coupon.countDocuments({ status: "active" }),
    Coupon.countDocuments({ status: "inactive" }),
    Order.countDocuments(orderRange),
    Order.aggregate([
      {
        $match: {
          ...orderRange,
          status: { $ne: "Cancelled" },
        },
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$total" },
          count: { $sum: 1 },
        },
      },
    ]),
    Order.aggregate([
      { $match: orderRange },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Order.find(orderRange)
      .sort({ createdAt: -1, _id: -1 })
      .limit(5)
      .select("orderNumber customer.name status total createdAt"),
    Order.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: "UTC",
            },
          },
          count: { $sum: 1 },
        },
      },
    ]),
    Product.find({ status: "Active" })
      .populate({ path: "category", select: "name" })
      .sort({ bestseller: -1, stock: 1, createdAt: -1 })
      .limit(4)
      .select("productId name category stock bestseller"),
  ]);

  const sales = salesTotals[0] || { revenue: 0, count: 0 };
  const byStatus = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0]));

  for (const row of statusRows) {
    if (row._id in byStatus) {
      byStatus[row._id] = row.count;
    }
  }

  res.status(200).json({
    success: true,
    data: {
      summary: {
        range,
        products: {
          total: productTotal,
          active: productActive,
          archived: productDraft,
          categories: categoryTotal,
        },
        orders: {
          total: orderTotal,
          grossSales: sales.revenue || 0,
          completedOrders: sales.count || 0,
          averageOrder: sales.count
            ? Math.round((sales.revenue || 0) / sales.count)
            : 0,
          byStatus,
          byDay: buildDailyActivity(dailyRows),
          recent: recentOrders.map((order) => ({
            id: order.orderNumber,
            customer: order.customer?.name || "",
            status: order.status,
            total: order.total,
            createdAt: order.createdAt,
          })),
        },
        users: {
          total: userTotal,
          active: userActive,
          suspended: userSuspended,
          admins: adminTotal,
        },
        coupons: {
          total: couponTotal,
          active: couponActive,
          inactive: couponInactive,
        },
        topProducts: topProducts.map((product) => ({
          id: product.productId,
          name: product.name,
          category: product.category?.name || "",
          stock: product.stock,
          bestseller: Boolean(product.bestseller),
        })),
      },
    },
  });
};
