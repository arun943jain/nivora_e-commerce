import { Router } from "express";
import {
  addCartItem,
  clearCart,
  getCart,
  mergeGuestCart,
  quoteCart,
  removeCartItem,
  updateCartItem,
} from "../controllers/cartController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
router.use(requireAuth);

router.get("/", getCart);
router.post("/items", addCartItem);
router.patch("/items/:productId", updateCartItem);
router.delete("/items/:productId", removeCartItem);
router.post("/merge", mergeGuestCart);
router.post("/quote", quoteCart);
router.delete("/", clearCart);

export default router;
