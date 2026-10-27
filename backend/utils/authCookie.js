import env from "../config/env.js";
import generateToken, { verifySessionToken } from "./generateToken.js";
import { SESSION_MAX_AGE_MS, SIGNUP_COOKIE_MAX_AGE_MS } from "../config/constants.js";

const COOKIE_NAME = "token";
const SIGNUP_COOKIE_NAME = "signup";

// The frontend always calls the API on its own origin (/api, proxied by Vite now and Vercel later),
// so the cookie is first-party and SameSite=Lax works everywhere. Lax also blocks most CSRF.
const cookieOptions = {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/"
};

// Only the auth routes read the sign-up cookie, so the browser doesn't send it anywhere else.
const signupCookieOptions = { ...cookieOptions, path: "/api/auth" };

export const setAuthCookie = (res, userId) => {
    res.cookie(COOKIE_NAME, generateToken(userId), { ...cookieOptions, maxAge: SESSION_MAX_AGE_MS });
};

export const clearAuthCookie = (res) => {
    res.clearCookie(COOKIE_NAME, cookieOptions);
};

export const readAuthCookie = (req) => req.cookies?.[COOKIE_NAME];

// The user id in a valid session cookie, or null (no cookie, expired, tampered, or not a session token).
// Only a signature check, no database: for places that run without isAuthenticated (logout, the API rate limit).
export const readSessionUserId = (req) => {
    try {
        return verifySessionToken(readAuthCookie(req)).userId;
    } catch {
        return null;
    }
};

// The random nonce given to the browser that set an unverified account's password (see verifyEmail).
export const setSignupCookie = (res, nonce) => {
    res.cookie(SIGNUP_COOKIE_NAME, nonce, { ...signupCookieOptions, maxAge: SIGNUP_COOKIE_MAX_AGE_MS });
};

export const clearSignupCookie = (res) => {
    res.clearCookie(SIGNUP_COOKIE_NAME, signupCookieOptions);
};

export const readSignupCookie = (req) => req.cookies?.[SIGNUP_COOKIE_NAME];
