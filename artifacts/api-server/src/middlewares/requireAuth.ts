import type { Request, Response, NextFunction } from "express";
import { verifyToken, type JwtPayload } from "../lib/auth";
import { db } from "@workspace/db";
import { sessionsTable } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      auth?: JwtPayload;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.session as string | undefined;
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }

  if (payload.sessionToken) {
    try {
      const [session] = await db
        .select({ id: sessionsTable.id })
        .from(sessionsTable)
        .where(
          and(
            eq(sessionsTable.sessionToken, payload.sessionToken),
            eq(sessionsTable.isActive, true),
          ),
        )
        .limit(1);

      if (!session) {
        res.clearCookie("session", { path: "/" });
        res.status(401).json({ error: "Session expired or logged in on another device" });
        return;
      }
    } catch {
      // DB check failed — fail open so a DB hiccup doesn't lock everyone out
    }
  }

  req.auth = payload;
  next();
}
