import type { Request, Response, NextFunction } from "express";
import { verifyToken, type JwtPayload } from "../lib/auth";

declare global {
  namespace Express {
    interface Request {
      auth?: JwtPayload;
    }
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
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
  if (payload.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  req.auth = payload;
  next();
}
