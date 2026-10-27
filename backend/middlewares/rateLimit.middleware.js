import rateLimit, { ipKeyGenerator, MemoryStore } from "express-rate-limit";
import { readSessionUserId } from "../utils/authCookie.js";

const ONE_MINUTE = 60 * 1000;
const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * ONE_HOUR;

const limitResponse = (message) => ({ success: false, message });

// A whole hostel often shares one public IP (campus Wi-Fi), so limiting by IP alone would
// lock out innocent students. Logged-in requests are limited per account; login/signup
// requests per IP *and* email.
const accountKey = (req) =>
    req.user
        ? `user:${req.user._id}`
        : `${ipKeyGenerator(req.ip)}|${String(req.body?.email ?? "").trim().toLowerCase()}`;

// Every API route: generous, just stops runaway scripts. It runs before isAuthenticated, so it recognises
// a logged-in request by its session cookie (a signature check, no database) and counts it per account.
// A forged or expired cookie, or a socket token, isn't a session: it counts against its IP, so nobody can
// pick another student's allowance.
export const apiLimiter = rateLimit({
    windowMs: FIFTEEN_MINUTES,
    limit: 1000,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (req) => {
        const userId = readSessionUserId(req);
        return userId ? `user:${userId}` : ipKeyGenerator(req.ip);
    },
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
    keyGenerator: accountKey,
    message: limitResponse("Too many attempts. Please try again in 15 minutes.")
});

// A second guard on login, verify-email and reset-password, keyed by the email alone. The IP part of
// credentialLimiter's key can be faked (a forged X-Forwarded-For), so rotating it must not give an
// attacker unlimited guesses against one account. Only failed attempts count.
export const loginEmailLimiter = rateLimit({
    windowMs: ONE_HOUR,
    limit: 20,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (req) => `email:${String(req.body?.email ?? "").trim().toLowerCase()}`,
    message: limitResponse("Too many attempts for this account. Please try again in an hour.")
});

// Anything that sends an email: stops using CampusSwap to spam someone's inbox.
// Only successful requests count (those are the ones that send mail), so typos don't use up the limit.
export const emailLimiter = rateLimit({
    windowMs: FIFTEEN_MINUTES,
    limit: 6,
    skipFailedRequests: true,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: accountKey,
    message: limitResponse("Too many emails requested. Please try again in 15 minutes.")
});

// The one limit keyed by IP alone, on purpose: every code goes out through one email account with a daily
// quota, so a single network mustn't use it up with made-up campus addresses. It's far above a normal day
// of sign-ups from one hostel (raise it before a launch on one campus network). Sign-up, resend and forgot
// password share it, and every successful request counts, whether or not an email really went out, so
// the count can't reveal who has an account.
const MAIL_PER_IP_PER_DAY = 100;
const mailStore = new MemoryStore();
const mailKey = (req) => `mail:${ipKeyGenerator(req.ip)}`;

export const mailIpLimiter = rateLimit({
    windowMs: ONE_DAY,
    limit: MAIL_PER_IP_PER_DAY,
    skipFailedRequests: true,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    store: mailStore,
    keyGenerator: mailKey,
    message: limitResponse("Too many emails from this network today. Please try again tomorrow.")
});

// Logging in to an unverified account sends a fresh code too, but /login can't sit behind mailIpLimiter:
// it must never stop verified students from logging in. That email takes from the same allowance here
// instead; false means none is left.
export const takeMailAllowance = async (req) => (await mailStore.increment(mailKey(req))).totalHits <= MAIL_PER_IP_PER_DAY;

// Every limiter below runs after isAuthenticated, so it counts per account. Requests that fail
// (validation, permissions) don't use up anyone's allowance.
const accountLimiter = (windowMs, limit, message) =>
    rateLimit({
        windowMs,
        limit,
        skipFailedRequests: true,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        keyGenerator: accountKey,
        message: limitResponse(message)
    });

// Posting listings: stops spam floods.
export const listingLimiter = accountLimiter(ONE_HOUR, 20, "You've posted a lot in the last hour. Please try again later.");

// Editing a listing or changing its status.
export const editLimiter = accountLimiter(ONE_HOUR, 60, "You've edited a lot in the last hour. Please try again later.");

// The browser asks for a socket token on every (re)connect, so this one is generous.
export const socketTokenLimiter = accountLimiter(FIFTEEN_MINUTES, 120, "Too many connection attempts. Please wait a few minutes.");

export const conversationLimiter = accountLimiter(ONE_HOUR, 30, "You've started a lot of chats in the last hour. Please try again later.");

export const chatLimiter = accountLimiter(ONE_MINUTE, 40, "You're sending messages too fast. Take a breather.");

// Photos cost storage, so they get their own, smaller allowance on top of chatLimiter.
export const chatImageLimiter = accountLimiter(ONE_HOUR, 20, "You've sent a lot of photos in the last hour. Please try again later.");

// Every new profile photo is another Cloudinary upload, so changing (or removing) it gets a small allowance too.
export const avatarLimiter = accountLimiter(ONE_HOUR, 10, "You've changed your photo a lot in the last hour. Please try again later.");

// Making an offer and answering one (counter, accept, decline, withdraw) share this allowance.
export const offerLimiter = accountLimiter(ONE_HOUR, 20, "You've made a lot of offers in the last hour. Please try again later.");

// Proposing and confirming meetups, refreshing the handover code and cancelling: most of them notify
// the other person, so they can't be used to spam them. (Entering a handover code uses credentialLimiter.)
export const dealActionLimiter = accountLimiter(ONE_HOUR, 30, "You've changed your deals a lot in the last hour. Please try again later.");

export const reviewLimiter = accountLimiter(ONE_HOUR, 20, "You've written a lot of reviews in the last hour. Please try again later.");

export const blockLimiter = accountLimiter(ONE_HOUR, 20, "You've blocked and unblocked a lot in the last hour. Please try again later.");

// Every report lands in an admin's queue, so this is the smallest allowance.
export const reportLimiter = accountLimiter(ONE_DAY, 10, "You've sent a lot of reports today. Please try again tomorrow.");

// Moderation decisions (reports, listings, suspensions): plenty for a busy evening of reviewing, but a
// stolen admin session can't wipe out a campus in a few seconds.
export const adminLimiter = accountLimiter(ONE_HOUR, 120, "You've made a lot of moderation changes in the last hour. Please try again later.");
