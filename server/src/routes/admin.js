import { Router } from "express";
import {
  createAdminCoupon,
  deactivateAdminCoupon,
  listAdminCoupons,
  updateAdminCoupon,
} from "../controllers/adminCouponController.js";
import { getAdminDashboard } from "../controllers/adminDashboardController.js";
import {
  getAdminOrder,
  listAdminOrders,
  updateAdminOrderStatus,
} from "../controllers/adminOrderController.js";
import {
  createAdminProduct,
  deactivateAdminProduct,
  listAdminProducts,
  updateAdminProduct,
} from "../controllers/adminProductController.js";
import {
  listAdminUsers,
  updateAdminUser,
} from "../controllers/adminUserController.js";
import { requireAdmin, requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
router.use(requireAuth, requireAdmin);

router.get("/dashboard", getAdminDashboard);

router.get("/products", listAdminProducts);
router.post("/products", createAdminProduct);
router.patch("/products/:id", updateAdminProduct);
router.delete("/products/:id", deactivateAdminProduct);

router.get("/orders", listAdminOrders);
router.get("/orders/:id", getAdminOrder);
router.patch("/orders/:id/status", updateAdminOrderStatus);

router.get("/users", listAdminUsers);
router.patch("/users/:id", updateAdminUser);

router.get("/coupons", listAdminCoupons);
router.post("/coupons", createAdminCoupon);
router.patch("/coupons/:id", updateAdminCoupon);
router.delete("/coupons/:id", deactivateAdminCoupon);

export default router;
