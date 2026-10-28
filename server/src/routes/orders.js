import { Router } from "express";
import {
  createOrder,
  getOrderById,
  listOrders,
} from "../controllers/orderController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
router.use(requireAuth);

router.post("/", createOrder);
router.get("/", listOrders);
router.get("/:id", getOrderById);

export default router;
