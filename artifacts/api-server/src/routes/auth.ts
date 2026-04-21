import { Router } from "express";
import bcrypt from "bcrypt";
import { db } from "@workspace/db";
import { usersTable, verificationCodesTable } from "@workspace/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { signToken, verifyToken, generateVerificationCode } from "../lib/auth";
import { sendVerificationEmail } from "../lib/email";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";

const router = Router();

const BCRYPT_ROUNDS = 10;
const CODE_TTL_MINUTES = 10;

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/",
  };
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
      .values({
        email: email.toLowerCase().trim(),
        passwordHash,
        fullName: fullName.trim(),
      })
      .returning();

    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

    await db.insert(verificationCodesTable).values({
      userId: user.id,
      code,
      type: "register",
      expiresAt,
    });

    await sendVerificationEmail(user.email, code, "register");

    res.json({ step: "verify", email: user.email });
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

    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

    await db.insert(verificationCodesTable).values({
      userId: user.id,
      code,
      type: "login",
      expiresAt,
    });

    await sendVerificationEmail(user.email, code, "login");

    res.json({ step: "verify", email: user.email });
  } catch (err) {
    logger.error(err, "login error");
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/verify", async (req, res) => {
  try {
    const { email, code, type } = req.body as {
      email?: string;
      code?: string;
      type?: string;
    };

    if (!email || !code || !type) {
      res.status(400).json({ error: "email, code, and type are required" });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()))
      .limit(1);

    if (!user) {
      res.status(400).json({ error: "Invalid verification" });
      return;
    }

    const [record] = await db
      .select()
      .from(verificationCodesTable)
      .where(
        and(
          eq(verificationCodesTable.userId, user.id),
          eq(verificationCodesTable.code, code.trim().toUpperCase()),
          eq(verificationCodesTable.type, type),
          eq(verificationCodesTable.used, false),
          gt(verificationCodesTable.expiresAt, new Date()),
        ),
      )
      .orderBy(verificationCodesTable.createdAt)
      .limit(1);

    if (!record) {
      res.status(400).json({ error: "Invalid or expired verification code" });
      return;
    }

    await db
      .update(verificationCodesTable)
      .set({ used: true })
      .where(eq(verificationCodesTable.id, record.id));

    const token = signToken({
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
    });

    res.cookie("session", token, cookieOptions());
    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    logger.error(err, "verify error");
    res.status(500).json({ error: "Verification failed" });
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

    res.json({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      createdAt: user.createdAt,
    });
  } catch (err) {
    logger.error(err, "me error");
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

export default router;
