import crypto from "crypto";
import env from "../config/env.js";
import { HANDOVER_TTL_MINUTES } from "../config/constants.js";

// The seller proves the handover happened by showing the buyer a QR code (carrying a long random
// token) or a 6-digit code to type in. Only HMAC hashes of them are stored, keyed with the server's
// secret and the deal id: a leaked hash can't be brute-forced without the secret (a plain SHA-256 of a
// 6-digit number takes milliseconds), and a hash from one deal is useless on another.
// The plain values are only ever in the seller's response. Never log them.

export const handoverHash = (dealId, value) =>
    crypto.createHmac("sha256", env.JWT_SECRET).update(`${dealId}:${value}`).digest("hex");

// A fresh pair each time the seller opens (or refreshes) the handover screen.
export const newHandover = (dealId, now = new Date()) => {
    const token = crypto.randomBytes(24).toString("base64url");
    // crypto.randomInt is cryptographically secure; Math.random() is not.
    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");

    return {
        token,
        code,
        qr: `campusswap:handover:${dealId}:${token}`,
        expiresAt: new Date(now.getTime() + HANDOVER_TTL_MINUTES * 60 * 1000),
        tokenHash: handoverHash(dealId, token),
        codeHash: handoverHash(dealId, code)
    };
};
