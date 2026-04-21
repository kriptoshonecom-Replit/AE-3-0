// Uses the Resend Replit integration for transactional email.
// Falls back to console.log if the connection is unavailable (dev without connector).
import { Resend } from "resend";
import { logger } from "./logger";

async function getResendClient(): Promise<{ client: Resend; fromEmail: string } | null> {
  try {
    const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
    if (!hostname) return null;

    const xReplitToken = process.env.REPL_IDENTITY
      ? "repl " + process.env.REPL_IDENTITY
      : process.env.WEB_REPL_RENEWAL
        ? "depl " + process.env.WEB_REPL_RENEWAL
        : null;

    if (!xReplitToken) return null;

    const res = await fetch(
      `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=resend`,
      {
        headers: {
          Accept: "application/json",
          "X-Replit-Token": xReplitToken,
        },
      },
    );

    const data = await res.json() as { items?: Array<{ settings: { api_key?: string; from_email?: string } }> };
    const conn = data.items?.[0];

    if (!conn?.settings?.api_key) return null;

    return {
      client: new Resend(conn.settings.api_key),
      fromEmail: conn.settings.from_email ?? "noreply@aloha-cpq.app",
    };
  } catch {
    return null;
  }
}

async function send(to: string, subject: string, html: string): Promise<void> {
  const resend = await getResendClient();
  if (resend) {
    const { error } = await resend.client.emails.send({ from: resend.fromEmail, to, subject, html });
    if (error) {
      logger.error({ error, to, subject }, "Resend error — falling back to console log");
      console.log(`\n📧 EMAIL to ${to} | Subject: ${subject}\n[Resend error — check API key / domain]\n`);
    } else {
      logger.info({ to, subject }, "Email sent via Resend");
    }
  } else {
    logger.warn({ to, subject }, "Resend not configured — email logged to console");
    console.log(`\n📧 EMAIL to ${to} | Subject: ${subject}\n`);
  }
}

export async function sendWelcomeEmail(
  to: string,
  fullName: string,
  password: string,
): Promise<void> {
  const subject = "Welcome to Aloha Essential CPQ 3.0 — Your Account Details";

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1e293b">
      <h2 style="color:#7c3aed;margin:0 0 4px">Aloha Essential CPQ 3.0</h2>
      <p style="color:#64748b;font-size:13px;margin:0 0 28px">Quote Builder Platform</p>

      <p style="font-size:15px;margin:0 0 16px">Hi <strong>${fullName}</strong>,</p>
      <p style="font-size:14px;color:#334155;margin:0 0 24px">
        An admin has created an account for you on <strong>Aloha Essential CPQ 3.0</strong>.
        Use the credentials below to sign in and get started.
      </p>

      <div style="background:#f8f7ff;border:1px solid #e2d9f3;border-radius:10px;padding:20px 24px;margin-bottom:24px">
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#7c3aed;padding:6px 0;width:100px">Email</td>
            <td style="font-size:14px;color:#1e293b;padding:6px 0">${to}</td>
          </tr>
          <tr>
            <td style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#7c3aed;padding:6px 0">Password</td>
            <td style="font-size:14px;font-family:monospace;color:#1e293b;padding:6px 0;font-weight:600">${password}</td>
          </tr>
        </table>
      </div>

      <p style="font-size:13px;color:#64748b;margin:0 0 8px">
        For your security, please change your password after signing in for the first time.
      </p>
      <p style="font-size:13px;color:#94a3b8;margin:0">
        If you weren't expecting this email, please ignore it or contact your administrator.
      </p>
    </div>
  `;

  await send(to, subject, html);
}
