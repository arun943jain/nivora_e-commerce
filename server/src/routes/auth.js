import { Router } from "express";
import {
  currentUser,
  login,
  logout,
  register,
} from "../controllers/authController.js";
import { authRateLimit } from "../middleware/authRateLimit.js";
import { requireDatabase } from "../middleware/requireDatabase.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

router.post("/register", authRateLimit, requireDatabase, register);
router.post("/login", authRateLimit, requireDatabase, login);
router.post("/logout", logout);
router.get("/me", requireAuth, currentUser);

export default router;
