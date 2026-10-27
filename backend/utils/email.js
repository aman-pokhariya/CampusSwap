import nodemailer from "nodemailer";
import env from "../config/env.js";
import ApiError from "./ApiError.js";
import { OTP_PURPOSE, OTP_TTL_MS } from "../config/constants.js";

// Sign-ups wait for the email to go out, so a slow provider mustn't keep them hanging.
const BREVO_TIMEOUT_MS = 10 * 1000;

const transporter = env.emailProvider === "smtp"
    ? nodemailer.createTransport({
        service: "gmail",
        auth: { user: env.EMAIL_USER, pass: env.EMAIL_PASS }
    })
    : null;

const COPY = {
    [OTP_PURPOSE.VERIFY_EMAIL]: {
        subject: "Your CampusSwap verification code",
        heading: "Verify your college email",
        intro: "Use this code to finish creating your CampusSwap account."
    },
    [OTP_PURPOSE.RESET_PASSWORD]: {
        subject: "Your CampusSwap password reset code",
        heading: "Reset your password",
        intro: "Use this code to set a new password. If you didn't ask for this, you can ignore this email."
    }
};

// The name is user input, so escape it before putting it in HTML.
const escapeHtml = (text) =>
    String(text).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

const otpEmailHtml = ({ greeting, code, heading, intro, minutes }) => `
<div style="background:#f1f5f9;padding:32px 16px;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:24px;color:#ffffff;font-size:20px;font-weight:700;">
      CampusSwap
    </div>
    <div style="padding:28px 24px;color:#0f172a;">
      <h1 style="margin:0 0 8px;font-size:20px;">${heading}</h1>
      <p style="margin:0 0 20px;color:#475569;line-height:1.5;">${escapeHtml(greeting)}, ${intro}</p>
      <div style="font-size:34px;font-weight:700;letter-spacing:10px;text-align:center;padding:16px;background:#eef2ff;color:#3730a3;border-radius:12px;">
        ${code}
      </div>
      <p style="margin:20px 0 0;color:#64748b;font-size:13px;">This code expires in ${minutes} minutes. Never share it with anyone — CampusSwap will never ask for it.</p>
    </div>
  </div>
</div>`;

const logOtpToConsole = (to, code, purpose) => {
    console.log(`\n┌──────────── 📧 OTP (development only) ────────────`);
    console.log(`│  To:      ${to}`);
    console.log(`│  Purpose: ${purpose}`);
    console.log(`│  Code:    ${code}`);
    console.log(`└────────────────────────────────────────────────────\n`);
};

// ── Providers ─────────────────────────────────────────────
// Each one sends { to, subject, text, html } or throws an error whose message is safe to log: it never
// contains the API key or the email's content (which holds the code).

// Brevo explains a refusal in { code, message }, e.g. "Key not found" or an unverified sender.
const brevoReason = (answer) => {
    try {
        return String(JSON.parse(answer).message ?? "").slice(0, 200);
    } catch {
        return "";
    }
};

// Brevo's transactional email API: plain HTTPS, so it also works where outgoing SMTP is blocked.
const sendWithBrevo = async ({ to, subject, text, html }) => {
    let response;
    try {
        response = await fetch(env.BREVO_API_URL, {
            method: "POST",
            headers: { "api-key": env.BREVO_API_KEY, "content-type": "application/json" },
            body: JSON.stringify({ sender: env.emailSender, to: [{ email: to }], subject, htmlContent: html, textContent: text }),
            signal: AbortSignal.timeout(BREVO_TIMEOUT_MS)
        });
    } catch (err) {
        throw new Error(err.name === "TimeoutError"
            ? `Brevo didn't answer within ${BREVO_TIMEOUT_MS / 1000} s`
            : `Couldn't reach Brevo (${err.cause?.code ?? err.cause?.message ?? err.message})`);
    }

    // Read the answer either way, so the connection is free for the next email.
    const answer = await response.text().catch(() => "");
    if (!response.ok) {
        const reason = brevoReason(answer);
        throw new Error(`Brevo refused the email (HTTP ${response.status}${reason ? `: ${reason}` : ""})`);
    }
};

// Gmail over SMTP. Fine locally and on paid hosts; Render's free plan blocks the SMTP ports.
const sendWithSmtp = (email) =>
    transporter.sendMail({ from: env.EMAIL_FROM || `CampusSwap <${env.EMAIL_USER}>`, ...email });

const send = { brevo: sendWithBrevo, smtp: sendWithSmtp }[env.emailProvider];

// One line for the startup log: how codes reach people right now.
export const emailModeNotice = () => {
    if (env.emailProvider === "brevo") return `📧 Emails go out through Brevo's API (${new URL(env.BREVO_API_URL).host}).`;
    if (env.emailProvider === "smtp") return "📧 Emails go out through Gmail (SMTP).";
    return env.isProduction
        ? "📧 Email not configured: sign-up and password reset codes can't be sent."
        : "📧 Email not configured: OTP codes will be printed in this terminal.";
};

export const sendOtpEmail = async ({ to, name, code, purpose }) => {
    // In development the code is always printed here too, so you can test with any seeded campus email.
    if (!env.isProduction) logOtpToConsole(to, code, purpose);

    if (!env.emailEnabled) {
        if (env.isProduction) throw new ApiError(503, "Email service is not configured. Please try again later.");
        return;
    }

    const { subject, heading, intro } = COPY[purpose];
    const minutes = OTP_TTL_MS / 60000;
    // A sign-up's name is whatever was typed, and the code can land in someone else's inbox, so
    // verification emails don't repeat it. Reset codes only go to verified accounts.
    const greeting = purpose === OTP_PURPOSE.RESET_PASSWORD ? `Hi ${name}` : "Hi there";

    try {
        await send({
            to,
            subject,
            text: `${greeting}, your CampusSwap code is ${code}. It expires in ${minutes} minutes.`,
            html: otpEmailHtml({ greeting, code, heading, intro, minutes })
        });
    } catch (err) {
        console.error("❌ Email send failed:", err.message);
        // In development the code is already in the terminal, so the flow can continue.
        if (env.isProduction) throw new ApiError(502, "We couldn't send the email. Please try again in a minute.");
    }
};
