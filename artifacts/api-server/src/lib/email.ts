import nodemailer from "nodemailer";
import { logger } from "./logger";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM ?? "noreply@aloha-cpq.app";

const transporter = SMTP_HOST && SMTP_USER && SMTP_PASS
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  : null;

export async function sendVerificationEmail(
  to: string,
  code: string,
  type: "register" | "login",
): Promise<void> {
  const subject = type === "register"
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

  if (transporter) {
    await transporter.sendMail({ from: SMTP_FROM, to, subject, html });
    logger.info({ to, type }, "Verification email sent");
  } else {
    logger.warn(
      { to, code, type },
      "SMTP not configured — verification code logged here for development",
    );
    console.log(`\n🔐 VERIFICATION CODE for ${to}: ${code}\n`);
  }
}
