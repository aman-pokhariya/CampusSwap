export const SESSION_DAYS = 7;
export const SESSION_MAX_AGE_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

// Session cookies and socket tokens are signed with the same secret but for different audiences,
// so one can never be used as the other (middlewares/auth.middleware.js, socket/index.js).
export const TOKEN_AUDIENCE = Object.freeze({
    SESSION: "session",
    SOCKET: "socket"
});
export const SOCKET_TOKEN_TTL = "2m";

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
export const OTP_MAX_ATTEMPTS = 5;

// The browser that starts a sign-up keeps a "signup" cookie until the email is verified (see verifyEmail).
// A day rather than the code's 10 minutes: "Resend code" keeps sending fresh codes to the same sign-up.
export const SIGNUP_COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const OTP_PURPOSE = Object.freeze({
    VERIFY_EMAIL: "verify-email",
    RESET_PASSWORD: "reset-password"
});

export const ROLES = Object.freeze({
    USER: "user",
    ADMIN: "admin"
});

// Campus admins manage their own campus; global admins (npm run make-admin -- <email> --global) every campus.
export const ADMIN_SCOPE = Object.freeze({
    CAMPUS: "campus",
    GLOBAL: "global"
});

// What every member starts with. Older accounts get it from scripts/seed.js (lean reads skip schema defaults).
export const DEFAULT_TRUST = Object.freeze({ score: 50, completedDeals: 0, ratingAvg: 0, ratingCount: 0, cancellations: 0 });

// Campus fields sent along with the logged-in user.
export const CAMPUS_PUBLIC_FIELDS = "name shortName slug city hostels safeSpots";

// The only user fields other students ever see. Every populate() of a user passes one of these,
// so emails, roles and moderation data can't leak by accident. Trust is listed field by field:
// how often someone cancelled stays private to them (it still counts in their score).
export const PUBLIC_USER_FIELDS = "name avatar hostel";
export const PROFILE_USER_FIELDS = "name avatar hostel trust.score trust.completedDeals trust.ratingAvg trust.ratingCount createdAt lastSeenAt";

// ── Listings ──────────────────────────────────────────────
// Keep these in sync with frontend/src/constants/listing.js.
export const LISTING_TYPES = ["sell", "rent", "swap", "free", "wanted", "kit"];
export const LISTING_CATEGORIES = ["books", "electronics", "cycles", "hostel", "lab", "stationery", "clothing", "sports", "other"];
export const LISTING_CONDITIONS = ["new", "like-new", "good", "fair"];
export const RENT_PERIODS = ["day", "week", "month"];
export const FEED_SORTS = ["newest", "nearest", "price-asc", "price-desc", "relevance"];

export const LISTING_STATUS = Object.freeze({
    ACTIVE: "active",
    RESERVED: "reserved", // an offer was accepted and a deal holds it
    SOLD: "sold",
    EXPIRED: "expired"
});

// Moderation is separate from the lifecycle status above: a flagged listing keeps its status
// (even "reserved") and is only hidden until an admin approves it.
export const MODERATION_STATE = Object.freeze({
    OK: "ok",
    FLAGGED: "flagged",
    REMOVED: "removed"
});

// Status changes an owner may make, by current status. "reserved" is missing on purpose:
// only finishing or cancelling the deal moves a listing out of it.
export const OWNER_TRANSITIONS = Object.freeze({
    [LISTING_STATUS.ACTIVE]: [LISTING_STATUS.SOLD],
    [LISTING_STATUS.SOLD]: [LISTING_STATUS.ACTIVE],
    [LISTING_STATUS.EXPIRED]: [LISTING_STATUS.ACTIVE]
});

// Types where a price is required; "free" is always 0, the rest are optional.
export const PRICED_TYPES = ["sell", "rent", "kit"];

export const MAX_LISTING_IMAGES = 5;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const LISTING_LIFETIME_DAYS = 60;

// Seller fields shown on listing cards.
export const SELLER_CARD_FIELDS = PUBLIC_USER_FIELDS;

// ── Chat, offers, deals ───────────────────────────────────
export const MAX_MESSAGE_LENGTH = 2000;
export const MESSAGE_TYPES = ["text", "image", "offer", "system"];

// Events shown as centred system messages in a chat.
export const SYSTEM_EVENTS = [
    "offer_countered", "offer_accepted", "offer_declined", "offer_withdrawn", "offer_cancelled", "offer_expired",
    "deal_meetup_proposed", "deal_meetup_confirmed", "deal_completed", "deal_cancelled",
    "listing_sold", "listing_deleted"
];

export const OFFER_STATUS = Object.freeze({
    PENDING: "pending",
    ACCEPTED: "accepted",
    DECLINED: "declined",
    WITHDRAWN: "withdrawn",
    CANCELLED: "cancelled",
    EXPIRED: "expired"
});
export const OFFER_LIFETIME_HOURS = 48;

// Who buys and who sells in a deal (utils/roles.js decides it from the listing type).
export const DEAL_ROLES = ["buyer", "seller"];

export const DEAL_STATUS = Object.freeze({
    AGREED: "agreed",
    SCHEDULED: "scheduled",
    COMPLETED: "completed",
    CANCELLED: "cancelled"
});
export const CANCEL_REASONS = ["changed_mind", "found_another", "no_show", "not_as_described", "other"];
export const HANDOVER_TTL_MINUTES = 10;
export const MAX_HANDOVER_ATTEMPTS = 5;

// A meetup can be planned up to this far ahead.
export const MEETUP_MAX_DAYS = 30;

// A finished deal asks for a review (and counts on the Deals badge) for this long, then stops nagging.
export const REVIEW_REMINDER_DAYS = 30;
export const MAX_REVIEW_LENGTH = 500;

// Rent deals: how long one rental period lasts, for "due back on".
export const RENT_PERIOD_DAYS = Object.freeze({ day: 1, week: 7, month: 30 });

// ── Reports, auto-flagging, blocks ────────────────────────
export const REPORT_TARGETS = ["listing", "user", "message"];
export const REPORT_REASONS = ["scam", "prohibited", "harassment", "fake", "spam", "other"];
export const REPORT_SOURCES = ["user", "ai", "keywords"];
export const REPORT_STATUS = Object.freeze({
    OPEN: "open",
    RESOLVED: "resolved",
    DISMISSED: "dismissed"
});
export const REPORT_ACTIONS = ["none", "listing_removed", "listing_restored", "user_warned", "user_banned"];
// Admin decisions that count against the reported person's trust score.
export const UPHELD_REPORT_ACTIONS = ["listing_removed", "user_warned", "user_banned"];

// What an admin can decide about a report, and about a listing in the review queue (controllers/admin.controllers.js).
export const ADMIN_REPORT_ACTIONS = ["dismiss", "remove_listing", "restore_listing", "warn_user", "ban_user"];
export const ADMIN_LISTING_ACTIONS = ["approve", "remove"];

// A listing is hidden for review once reports from this many different students count (utils/reports.js)...
export const AUTO_FLAG_REPORTS = 3;
// ...unless its owner has this many completed deals (an admin decides instead),
export const AUTO_FLAG_TRUSTED_DEALS = 3;
// ...or this many listings on the campus were already auto-hidden in the last hour.
export const AUTO_FLAG_CAMPUS_HOURLY_CAP = 3;

export const NOTIFICATION_TYPES = [
    "offer_received", "offer_countered", "offer_accepted", "offer_declined", "offer_withdrawn", "offer_cancelled", "offer_expired",
    "deal_meetup_proposed", "deal_meetup_confirmed", "deal_completed", "deal_cancelled", "review_received",
    "swap_circle_proposed", "swap_circle_accepted", "swap_circle_declined", "swap_circle_completed", "swap_circle_cancelled",
    "listing_flagged", "listing_restored", "listing_removed", "listing_expiring", "listing_expired",
    "saved_search_match", "report_resolved", "account_warning"
];
