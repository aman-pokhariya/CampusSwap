import env from "../config/env.js";
import generateToken from "./generateToken.js";
import { SESSION_MAX_AGE_MS } from "../config/constants.js";

const COOKIE_NAME = "token";

// The frontend always calls the API on its own origin (/api, proxied by Vite now and Vercel later),
// so the cookie is first-party and SameSite=Lax works everywhere. Lax also blocks most CSRF.
const cookieOptions = {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/"
};

export const setAuthCookie = (res, userId) => {
    res.cookie(COOKIE_NAME, generateToken(userId), { ...cookieOptions, maxAge: SESSION_MAX_AGE_MS });
};

export const clearAuthCookie = (res) => {
    res.clearCookie(COOKIE_NAME, cookieOptions);
};

export const readAuthCookie = (req) => req.cookies?.[COOKIE_NAME];
