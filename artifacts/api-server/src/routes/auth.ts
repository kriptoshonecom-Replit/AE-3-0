import { Router } from "express";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { usersTable, sessionsTable, loginEventsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { signToken } from "../lib/auth";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";
import { sendPasswordResetEmail } from "../lib/email";

const router = Router();

const BCRYPT_ROUNDS = 10;
const SESSION_DAYS = 7;

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
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

function userDto(u: typeof usersTable.$inferSelect) {
  return { id: u.id, email: u.email, fullName: u.fullName, role: u.role, createdAt: u.createdAt };
}

function getClientIp(req: Parameters<typeof router.post>[1] extends (req: infer R, ...rest: unknown[]) => unknown ? R : never): string | undefined {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress ?? undefined;
}

async function createSession(userId: string, req: Parameters<typeof router.post>[1] extends (req: infer R, ...rest: unknown[]) => unknown ? R : never) {
  const sessionToken = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const ip = getClientIp(req);
  const ua = (req.headers["user-agent"] as string | undefined) ?? null;

  await db.update(sessionsTable)
    .set({ isActive: false })
    .where(and(eq(sessionsTable.userId, userId), eq(sessionsTable.isActive, true)));

  await db.insert(sessionsTable).values({
    userId,
    sessionToken,
    ipAddress: ip ?? null,
    userAgent: ua,
    expiresAt,
    isActive: true,
  });

  return sessionToken;
}

async function recordLoginEvent(opts: {
  userId?: string;
  email: string;
  success: boolean;
  failureReason?: string;
  req: Parameters<typeof router.post>[1] extends (req: infer R, ...rest: unknown[]) => unknown ? R : never;
}) {
  try {
    const ip = getClientIp(opts.req);
    const ua = (opts.req.headers["user-agent"] as string | undefined) ?? null;
    await db.insert(loginEventsTable).values({
      userId: opts.userId ?? null,
      email: opts.email,
      ipAddress: ip ?? null,
      userAgent: ua,
      success: opts.success,
      failureReason: opts.failureReason ?? null,
    });
  } catch (err) {
    logger.warn(err, "failed to record login event");
  }
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
      .values({ email: email.toLowerCase().trim(), passwordHash, fullName: fullName.trim(), role: "user" })
      .returning();

    const sessionToken = await createSession(user.id, req);
    await recordLoginEvent({ userId: user.id, email: user.email, success: true, req });

    const token = signToken({ userId: user.id, email: user.email, fullName: user.fullName, role: user.role, sessionToken });
    res.cookie("session", token, cookieOptions());
    res.json({ user: userDto(user) });
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

    const normalised = email.toLowerCase().trim();

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, normalised))
      .limit(1);

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      await recordLoginEvent({
        userId: user?.id,
        email: normalised,
        success: false,
        failureReason: "Invalid email or password",
        req,
      });
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const sessionToken = await createSession(user.id, req);
    await recordLoginEvent({ userId: user.id, email: user.email, success: true, req });

    const token = signToken({ userId: user.id, email: user.email, fullName: user.fullName, role: user.role, sessionToken });
    res.cookie("session", token, cookieOptions());
    res.json({ user: userDto(user) });
  } catch (err) {
    logger.error(err, "login error");
    res.status(500).json({ error: "Login failed" });
  }
});

router.patch("/profile", requireAuth, async (req, res) => {
  try {
    const { fullName, email, currentPassword, newPassword } = req.body as {
      fullName?: string;
      email?: string;
      currentPassword?: string;
      newPassword?: string;
    };

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, req.auth!.userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const updates: Partial<typeof usersTable.$inferInsert> = {};

    if (fullName !== undefined && fullName.trim()) {
      updates.fullName = fullName.trim();
    }

    if (email !== undefined && email.trim()) {
      const normalised = email.toLowerCase().trim();
      if (normalised !== user.email) {
        const conflict = await db
          .select({ id: usersTable.id })
          .from(usersTable)
          .where(eq(usersTable.email, normalised))
          .limit(1);
        if (conflict.length > 0) {
          res.status(409).json({ error: "That email is already in use" });
          return;
        }
        updates.email = normalised;
      }
    }

    if (newPassword !== undefined && newPassword.length > 0) {
      if (!currentPassword) {
        res.status(400).json({ error: "Current password is required to set a new password" });
        return;
      }
      const match = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!match) {
        res.status(401).json({ error: "Current password is incorrect" });
        return;
      }
      if (!isStrongPassword(newPassword)) {
        res.status(400).json({
          error: "New password must be at least 8 characters and include a letter, a number, and a special character",
        });
        return;
      }
      updates.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "Nothing to update" });
      return;
    }

    const [updated] = await db
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, user.id))
      .returning();

    const sessionToken = req.auth!.sessionToken ?? (await createSession(updated.id, req));
    const token = signToken({ userId: updated.id, email: updated.email, fullName: updated.fullName, role: updated.role, sessionToken });
    res.cookie("session", token, cookieOptions());
    res.json({ user: userDto(updated) });
  } catch (err) {
    logger.error(err, "profile update error");
    res.status(500).json({ error: "Profile update failed" });
  }
});

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email?.trim()) {
    res.status(400).json({ error: "Email is required" });
    return;
  }
  const normalised = email.toLowerCase().trim();
  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, normalised))
      .limit(1);

    // Always respond OK — do not leak whether the email exists
    if (!user) {
      res.json({ success: true });
      return;
    }

    // Generate a strong 12-char password with upper, lower, digit, special
    const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const lower = "abcdefghjkmnpqrstuvwxyz";
    const digits = "23456789";
    const special = "!@#$%&*";
    const all = upper + lower + digits + special;
    const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
    let pw = pick(upper) + pick(lower) + pick(digits) + pick(special);
    for (let i = 4; i < 12; i++) pw += pick(all);
    // Shuffle
    const newPassword = pw.split("").sort(() => Math.random() - 0.5).join("");

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, user.id));

    await sendPasswordResetEmail(user.email, user.fullName, newPassword);

    res.json({ success: true });
  } catch (err) {
    logger.error(err, "forgot-password error");
    res.status(500).json({ error: "Failed to reset password" });
  }
});

router.post("/logout", requireAuth, async (req, res) => {
  try {
    const sessionToken = req.auth?.sessionToken;
    if (sessionToken) {
      await db.update(sessionsTable)
        .set({ isActive: false })
        .where(eq(sessionsTable.sessionToken, sessionToken));
    }
  } catch (err) {
    logger.warn(err, "logout session cleanup error");
  }
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

    if (req.auth?.sessionToken) {
      db.update(sessionsTable)
        .set({ lastActiveAt: new Date() })
        .where(eq(sessionsTable.sessionToken, req.auth.sessionToken))
        .catch(() => {});
    }

    res.json(userDto(user));
  } catch (err) {
    logger.error(err, "me error");
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

export default router;
