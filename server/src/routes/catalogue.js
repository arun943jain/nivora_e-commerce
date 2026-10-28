import { Router } from "express";
import {
  getProductBySlug,
  listCategories,
  listProducts,
} from "../controllers/catalogueController.js";
import { requireDatabase } from "../middleware/requireDatabase.js";

const router = Router();

router.get("/categories", requireDatabase, listCategories);
router.get("/products", requireDatabase, listProducts);
router.get("/products/:slug", requireDatabase, getProductBySlug);

export default router;
