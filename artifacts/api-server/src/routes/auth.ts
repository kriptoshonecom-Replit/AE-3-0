import { Router } from "express";
import bcrypt from "bcrypt";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { signToken } from "../lib/auth";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";

const router = Router();

const BCRYPT_ROUNDS = 10;

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  };
}

function isStrongPassword(pw: string): boolean {
  return (
    pw.length >= 8 &&
    /[A-Za-z]/.test(pw) &&
    /[0-9]/.test(pw) &&
    /[^A-Za-z0-9]/.test(pw)
  );
}

router.post("/register", async (req, res) => {
  try {
    const { email, password, fullName } = req.body as {
      email?: string;
      password?: string;
      fullName?: string;
    };

    if (!email || !password || !fullName) {
      res.status(400).json({ error: "email, password, and fullName are required" });
      return;
    }

    if (!isStrongPassword(password)) {
      res.status(400).json({
        error: "Password must be at least 8 characters and include a letter, a number, and a special character",
      });
      return;
    }

    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const [user] = await db
      .insert(usersTable)
      .values({ email: email.toLowerCase().trim(), passwordHash, fullName: fullName.trim() })
      .returning();

    const token = signToken({ userId: user.id, email: user.email, fullName: user.fullName });
    res.cookie("session", token, cookieOptions());
    res.json({ user: { id: user.id, email: user.email, fullName: user.fullName, createdAt: user.createdAt } });
  } catch (err) {
    logger.error(err, "register error");
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()))
      .limit(1);

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const token = signToken({ userId: user.id, email: user.email, fullName: user.fullName });
    res.cookie("session", token, cookieOptions());
    res.json({ user: { id: user.id, email: user.email, fullName: user.fullName, createdAt: user.createdAt } });
  } catch (err) {
    logger.error(err, "login error");
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/logout", (_req, res) => {
  res.clearCookie("session", { path: "/" });
  res.json({ success: true });
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, req.auth!.userId))
      .limit(1);

    if (!user) {
      res.clearCookie("session", { path: "/" });
      res.status(401).json({ error: "User not found" });
      return;
    }

    res.json({ id: user.id, email: user.email, fullName: user.fullName, createdAt: user.createdAt });
  } catch (err) {
    logger.error(err, "me error");
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

export default router;
