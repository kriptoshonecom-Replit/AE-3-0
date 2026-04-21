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

export async function sendVerificationEmail(
  to: string,
  code: string,
  type: "register" | "login",
): Promise<void> {
  const subject =
    type === "register"
      ? "Verify your Aloha CPQ account"
      : "Your Aloha CPQ sign-in code";

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
      <h2 style="color:#7c3aed;margin-bottom:8px">Aloha Essential CPQ 3.0</h2>
      <p style="color:#334155;font-size:15px;margin-bottom:24px">
        ${type === "register" ? "Thanks for signing up! Use the code below to verify your account." : "Use the code below to complete your sign-in."}
      </p>
      <div style="background:#f8f7ff;border:2px solid #7c3aed;border-radius:10px;padding:20px 24px;text-align:center;margin-bottom:24px">
        <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#7c3aed;font-family:monospace">${code}</span>
      </div>
      <p style="color:#64748b;font-size:13px">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
    </div>
  `;

  // WARNING: Never cache the Resend client — tokens expire.
  const resend = await getResendClient();

  if (resend) {
    const { error } = await resend.client.emails.send({
      from: resend.fromEmail,
      to,
      subject,
      html,
    });
    if (error) {
      // Resend is configured but returned an error (e.g. invalid API key or unverified domain).
      // Fall back to console so the auth flow still works while the integration is being set up.
      logger.error({ error, to, type }, "Resend error — falling back to console log");
      console.log(`\n🔐 VERIFICATION CODE for ${to}: ${code}\n`);
      logger.warn({ to, code, type }, "Code logged to console (Resend not ready yet)");
    } else {
      logger.info({ to, type }, "Verification email sent via Resend");
    }
  } else {
    logger.warn(
      { to, code, type },
      "Resend not configured — verification code logged here for development",
    );
    console.log(`\n🔐 VERIFICATION CODE for ${to}: ${code}\n`);
  }
}
