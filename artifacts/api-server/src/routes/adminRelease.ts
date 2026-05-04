import { Router } from "express";
import { requireAdmin } from "../middlewares/requireAdmin";
import { logger } from "../lib/logger";
import { pool } from "@workspace/db";
import { sendReleaseNotification } from "../lib/email";

interface ReleaseNotification {
  id: string;
  subject: string;
  message: string;
  recipientEmails: string[];
  sentAt: string | null;
  sentBy: string | null;
  createdAt: string;
}

function mapRow(row: Record<string, unknown>): ReleaseNotification {
  return {
    id: row.id as string,
    subject: row.subject as string,
    message: row.message as string,
    recipientEmails: (row.recipient_emails as string[]) ?? [],
    sentAt: row.sent_at as string | null,
    sentBy: row.sent_by as string | null,
    createdAt: row.created_at as string,
  };
}

/* ── Admin router ───────────────────────────────────────── */
const adminRouter = Router();
adminRouter.use(requireAdmin);

/* GET /api/admin/release-notifications */
adminRouter.get("/release-notifications", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM release_notifications ORDER BY created_at DESC`
    );
    res.json(rows.map(mapRow));
  } catch (err) {
    logger.error(err, "list release-notifications error");
    res.status(500).json({ error: "Failed to list notifications" });
  }
});

/* POST /api/admin/release-notifications */
adminRouter.post("/release-notifications", async (req, res) => {
  try {
    const { subject, message, recipientEmails } = req.body as {
      subject?: string;
      message?: string;
      recipientEmails?: string[];
    };
    if (!message?.trim()) {
      res.status(400).json({ error: "message is required" });
      return;
    }
    const { rows } = await pool.query(
      `INSERT INTO release_notifications (subject, message, recipient_emails)
       VALUES ($1, $2, $3) RETURNING *`,
      [subject?.trim() ?? "", message.trim(), JSON.stringify(recipientEmails ?? [])]
    );
    res.json(mapRow(rows[0]));
  } catch (err) {
    logger.error(err, "create release-notification error");
    res.status(500).json({ error: "Failed to create notification" });
  }
});

/* POST /api/admin/release-notifications/:id/send */
adminRouter.post("/release-notifications/:id/send", async (req, res) => {
  try {
    const { id } = req.params;
    const { recipientEmails } = req.body as { recipientEmails?: string[] };

    const { rows: existing } = await pool.query(
      `SELECT * FROM release_notifications WHERE id = $1`,
      [id]
    );
    if (!existing.length) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }

    const notif = mapRow(existing[0]);
    const emails = recipientEmails ?? notif.recipientEmails;
    if (!emails.length) {
      res.status(400).json({ error: "No recipients selected" });
      return;
    }

    const { rows: versionRows } = await pool.query(
      `SELECT value FROM app_settings WHERE key = 'app_version' LIMIT 1`
    );
    const version = versionRows[0]?.value ?? "6.0";

    const sentBy = (req as unknown as { user?: { email?: string } }).user?.email ?? "admin";
    const errors: string[] = [];

    await Promise.all(
      emails.map(async (email) => {
        try {
          await sendReleaseNotification(email, notif.subject, notif.message, version);
        } catch (e) {
          errors.push(email);
          logger.warn({ email, err: e }, "Failed to send release notification to recipient");
        }
      })
    );

    const { rows: updated } = await pool.query(
      `UPDATE release_notifications
       SET sent_at = NOW(), sent_by = $2, recipient_emails = $3
       WHERE id = $1 RETURNING *`,
      [id, sentBy, JSON.stringify(emails)]
    );

    res.json({ notification: mapRow(updated[0]), errors });
  } catch (err) {
    logger.error(err, "send release-notification error");
    res.status(500).json({ error: "Failed to send notification" });
  }
});

/* POST /api/admin/release-notifications/:id/clone */
adminRouter.post("/release-notifications/:id/clone", async (req, res) => {
  try {
    const { id } = req.params;
    const { rows: existing } = await pool.query(
      `SELECT * FROM release_notifications WHERE id = $1`,
      [id]
    );
    if (!existing.length) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }
    const src = mapRow(existing[0]);
    const { rows } = await pool.query(
      `INSERT INTO release_notifications (subject, message, recipient_emails)
       VALUES ($1, $2, $3) RETURNING *`,
      [src.subject, src.message, JSON.stringify(src.recipientEmails)]
    );
    res.json(mapRow(rows[0]));
  } catch (err) {
    logger.error(err, "clone release-notification error");
    res.status(500).json({ error: "Failed to clone notification" });
  }
});

/* DELETE /api/admin/release-notifications/:id */
adminRouter.delete("/release-notifications/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { rowCount } = await pool.query(
      `DELETE FROM release_notifications WHERE id = $1`,
      [id]
    );
    if (!rowCount) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error(err, "delete release-notification error");
    res.status(500).json({ error: "Failed to delete notification" });
  }
});

/* GET /api/admin/app-version */
adminRouter.get("/app-version", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT value FROM app_settings WHERE key = 'app_version' LIMIT 1`
    );
    res.json({ version: rows[0]?.value ?? "6.0" });
  } catch (err) {
    logger.error(err, "get app-version error");
    res.status(500).json({ error: "Failed to get version" });
  }
});

/* PATCH /api/admin/app-version — releases a new version */
adminRouter.patch("/app-version", async (req, res) => {
  try {
    const { version } = req.body as { version?: string };
    if (!version?.trim()) {
      res.status(400).json({ error: "version is required" });
      return;
    }
    if (!/^\d+\.\d+(\.\d+)?$/.test(version.trim())) {
      res.status(400).json({ error: "version must be in the format X.Y or X.Y.Z (e.g. 6.0, 6.1, 7.0)" });
      return;
    }
    await pool.query(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ('app_version', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [version.trim()]
    );
    res.json({ version: version.trim() });
  } catch (err) {
    logger.error(err, "patch app-version error");
    res.status(500).json({ error: "Failed to update version" });
  }
});

/* ── Public router (no auth) ────────────────────────────── */
const publicRouter = Router();

/* GET /api/app-version */
publicRouter.get("/app-version", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT value FROM app_settings WHERE key = 'app_version' LIMIT 1`
    );
    res.json({ version: rows[0]?.value ?? "6.0" });
  } catch (err) {
    logger.error(err, "public get app-version error");
    res.status(500).json({ error: "Failed to get version" });
  }
});

export { adminRouter as adminReleaseRouter, publicRouter as publicReleaseRouter };
