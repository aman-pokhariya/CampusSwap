import nodemailer from "nodemailer";
import env from "../config/env.js";
import ApiError from "./ApiError.js";
import { OTP_PURPOSE, OTP_TTL_MS } from "../config/constants.js";

const transporter = env.emailEnabled
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

const otpEmailHtml = ({ name, code, heading, intro, minutes }) => `
<div style="background:#f1f5f9;padding:32px 16px;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:24px;color:#ffffff;font-size:20px;font-weight:700;">
      CampusSwap
    </div>
    <div style="padding:28px 24px;color:#0f172a;">
      <h1 style="margin:0 0 8px;font-size:20px;">${heading}</h1>
      <p style="margin:0 0 20px;color:#475569;line-height:1.5;">Hi ${escapeHtml(name)}, ${intro}</p>
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

export const sendOtpEmail = async ({ to, name, code, purpose }) => {
    // In development the code is always printed here too, so you can test with any seeded campus email.
    if (!env.isProduction) logOtpToConsole(to, code, purpose);

    if (!transporter) {
        if (env.isProduction) throw new ApiError(503, "Email service is not configured. Please try again later.");
        return;
    }

    const { subject, heading, intro } = COPY[purpose];
    const minutes = OTP_TTL_MS / 60000;

    try {
        await transporter.sendMail({
            from: env.EMAIL_FROM || `CampusSwap <${env.EMAIL_USER}>`,
            to,
            subject,
            text: `Hi ${name}, your CampusSwap code is ${code}. It expires in ${minutes} minutes.`,
            html: otpEmailHtml({ name, code, heading, intro, minutes })
        });
    } catch (err) {
        console.error("❌ Email send failed:", err.message);
        // In development the code is already in the terminal, so the flow can continue.
        if (env.isProduction) throw new ApiError(502, "We couldn't send the email. Please try again in a minute.");
    }
};
