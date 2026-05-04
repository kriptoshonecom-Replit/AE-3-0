import { Router } from "express";
import { db } from "@workspace/db";
import { loginEventsTable, sessionsTable, usersTable } from "@workspace/db/schema";
import { desc, eq, and, isNotNull } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAdmin";
import { logger } from "../lib/logger";

const router = Router();
router.use(requireAdmin);

router.get("/admin/log-journal", async (req, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? "100"), 10) || 100, 500);
    const offset = parseInt(String(req.query.offset ?? "0"), 10) || 0;

    const events = await db
      .select({
        id: loginEventsTable.id,
        email: loginEventsTable.email,
        userId: loginEventsTable.userId,
        ipAddress: loginEventsTable.ipAddress,
        userAgent: loginEventsTable.userAgent,
        success: loginEventsTable.success,
        failureReason: loginEventsTable.failureReason,
        createdAt: loginEventsTable.createdAt,
        fullName: usersTable.fullName,
      })
      .from(loginEventsTable)
      .leftJoin(usersTable, eq(loginEventsTable.userId, usersTable.id))
      .orderBy(desc(loginEventsTable.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({ events, limit, offset });
  } catch (err) {
    logger.error(err, "log-journal fetch error");
    res.status(500).json({ error: "Failed to fetch log journal" });
  }
});

router.get("/admin/log-journal/sessions", async (req, res) => {
  try {
    const sessions = await db
      .select({
        id: sessionsTable.id,
        userId: sessionsTable.userId,
        ipAddress: sessionsTable.ipAddress,
        userAgent: sessionsTable.userAgent,
        createdAt: sessionsTable.createdAt,
        lastActiveAt: sessionsTable.lastActiveAt,
        expiresAt: sessionsTable.expiresAt,
        isActive: sessionsTable.isActive,
        fullName: usersTable.fullName,
        email: usersTable.email,
      })
      .from(sessionsTable)
      .leftJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
      .where(and(eq(sessionsTable.isActive, true), isNotNull(sessionsTable.userId)))
      .orderBy(desc(sessionsTable.lastActiveAt));

    res.json({ sessions });
  } catch (err) {
    logger.error(err, "sessions fetch error");
    res.status(500).json({ error: "Failed to fetch active sessions" });
  }
});

export default router;
