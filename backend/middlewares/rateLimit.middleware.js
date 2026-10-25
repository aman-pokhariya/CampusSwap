import rateLimit, { ipKeyGenerator } from "express-rate-limit";

const FIFTEEN_MINUTES = 15 * 60 * 1000;

const limitResponse = (message) => ({ success: false, message });

// A whole hostel often shares one public IP (campus Wi-Fi), so limiting by IP alone would
// lock out innocent students. Sensitive routes are limited per IP *and* email instead.
const ipAndEmailKey = (req) =>
    `${ipKeyGenerator(req.ip)}|${String(req.body?.email ?? "").trim().toLowerCase()}`;

// Every API route: generous, just stops runaway scripts.
export const apiLimiter = rateLimit({
    windowMs: FIFTEEN_MINUTES,
    limit: 1000,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: limitResponse("Too many requests. Please slow down.")
});

// Password and code checks: stops brute-forcing a password or an OTP.
// Only failed attempts count, so logging in successfully never locks anyone out.
export const credentialLimiter = rateLimit({
    windowMs: FIFTEEN_MINUTES,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: ipAndEmailKey,
    message: limitResponse("Too many attempts. Please try again in 15 minutes.")
});

// Anything that sends an email: stops using CampusSwap to spam someone's inbox.
// Only successful requests count (those are the ones that send mail), so typos don't use up the limit.
export const emailLimiter = rateLimit({
    windowMs: FIFTEEN_MINUTES,
    limit: 6,
    skipFailedRequests: true,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: ipAndEmailKey,
    message: limitResponse("Too many emails requested. Please try again in 15 minutes.")
});
