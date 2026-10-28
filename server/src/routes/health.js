import { Router } from "express";
import { getDatabaseStatus, isDatabaseConfigured } from "../config/db.js";

const router = Router();

router.get("/", (req, res) => {
  const databaseStatus = getDatabaseStatus();

  res.status(200).json({
    status: databaseStatus === "connected" ? "ok" : "degraded",
    api: "running",
    database: {
      configured: isDatabaseConfigured(),
      status: databaseStatus,
    },
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

export default router;
