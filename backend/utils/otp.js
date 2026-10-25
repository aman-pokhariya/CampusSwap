import crypto from "crypto";
import bcrypt from "bcrypt";
import Otp from "../models/otp.model.js";
import ApiError from "./ApiError.js";
import { sendOtpEmail } from "./email.js";
import { OTP_MAX_ATTEMPTS, OTP_RESEND_COOLDOWN_SECONDS, OTP_TTL_MS } from "../config/constants.js";

const COOLDOWN_MS = OTP_RESEND_COOLDOWN_SECONDS * 1000;

// Creates (or replaces) the code for this email + purpose and returns it in plain text.
const issueOtp = async (email, purpose) => {
    // crypto.randomInt is cryptographically secure; Math.random() is not.
    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
    const now = Date.now();

    try {
        // Atomic cooldown: the filter only matches when the last code is older than the cooldown.
        // If a recent code exists, the upsert tries to insert a second (email, purpose) document
        // and the unique index rejects it with error 11000.
        await Otp.findOneAndUpdate(
            { email, purpose, sentAt: { $lte: new Date(now - COOLDOWN_MS) } },
            {
                codeHash: await bcrypt.hash(code, 10),
                attempts: 0,
                sentAt: new Date(now),
                expiresAt: new Date(now + OTP_TTL_MS)
            },
            { upsert: true }
        );
    } catch (err) {
        if (err.code !== 11000) throw err;

        const existing = await Otp.findOne({ email, purpose }).select("sentAt");
        const waitMs = existing ? existing.sentAt.getTime() + COOLDOWN_MS - now : COOLDOWN_MS;
        const retryAfter = Math.max(1, Math.ceil(waitMs / 1000));
        throw new ApiError(429, `Please wait ${retryAfter}s before requesting another code`, { retryAfter });
    }

    return code;
};

// Generates and emails a code. Returns seconds until another code may be requested.
export const sendOtp = async ({ email, name, purpose }) => {
    const code = await issueOtp(email, purpose);

    try {
        await sendOtpEmail({ to: email, name, code, purpose });
    } catch (err) {
        // The email never left, so don't make the user sit through the cooldown.
        await Otp.deleteOne({ email, purpose });
        throw err;
    }

    return OTP_RESEND_COOLDOWN_SECONDS;
};

// Like sendOtp, but if a code went out moments ago it keeps that code instead of failing.
export const sendOtpIfAllowed = async (args) => {
    try {
        return await sendOtp(args);
    } catch (err) {
        if (err.statusCode === 429 && err.details?.retryAfter) return err.details.retryAfter;
        throw err;
    }
};

// Checks a code and deletes it on success. Every guess counts, so a code dies after OTP_MAX_ATTEMPTS.
export const consumeOtp = async (email, purpose, code) => {
    // Increment-then-check in one atomic step, so parallel guesses can't sneak past the attempt limit.
    const otp = await Otp.findOneAndUpdate(
        { email, purpose, expiresAt: { $gt: new Date() }, attempts: { $lt: OTP_MAX_ATTEMPTS } },
        { $inc: { attempts: 1 } },
        { returnDocument: "after" }
    );

    if (!otp) {
        throw new ApiError(400, "This code is no longer valid. Request a new one.", {
            code: "OTP_EXPIRED",
            errors: { otp: "Code no longer valid — request a new one" }
        });
    }

    const isMatch = await bcrypt.compare(code, otp.codeHash);

    if (!isMatch) {
        const attemptsLeft = OTP_MAX_ATTEMPTS - otp.attempts;
        const message = attemptsLeft > 0
            ? `Incorrect code. ${attemptsLeft} ${attemptsLeft === 1 ? "attempt" : "attempts"} left.`
            : "Incorrect code. Request a new one.";
        throw new ApiError(400, message, {
            code: attemptsLeft > 0 ? "OTP_INCORRECT" : "OTP_EXPIRED",
            errors: { otp: message }
        });
    }

    await otp.deleteOne();
};
