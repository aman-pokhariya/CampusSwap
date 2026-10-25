export const SESSION_DAYS = 7;
export const SESSION_MAX_AGE_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
export const OTP_MAX_ATTEMPTS = 5;

export const OTP_PURPOSE = Object.freeze({
    VERIFY_EMAIL: "verify-email",
    RESET_PASSWORD: "reset-password"
});

export const ROLES = Object.freeze({
    USER: "user",
    ADMIN: "admin"
});

// Campus fields sent along with the logged-in user.
export const CAMPUS_PUBLIC_FIELDS = "name shortName slug city hostels safeSpots";
