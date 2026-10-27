import { LISTING_STATUS, MODERATION_STATE } from "../config/constants.js";

// A listing has three independent sides: its lifecycle `status`, its `moderation` state and `deletedAt`.
// These helpers are the one place that turns them into "can people see it?".

const HIDDEN_STATES = [MODERATION_STATE.FLAGGED, MODERATION_STATE.REMOVED];

// Query filters are built fresh on every call because Mongoose rewrites them in place while casting.

// Not under review, not removed, not deleted. $nin (instead of "state: ok") also matches
// listings saved before the moderation field existed.
export const notHidden = () => ({
    "moderation.state": { $nin: HIDDEN_STATES },
    deletedAt: null
});

// What the feed, search, "similar", profiles and offers may use. Expiry is checked right here
// (lazily) instead of trusting a background job to have marked old listings as expired.
export const discoverable = (now = new Date()) => ({
    status: LISTING_STATUS.ACTIVE,
    ...notHidden(),
    expiresAt: { $gt: now }
});

// Hidden listings are a 404 for everyone except their owner and campus admins.
export const isHidden = (listing) => HIDDEN_STATES.includes(listing.moderation?.state) || Boolean(listing.deletedAt);

export const isDiscoverable = (listing, now = new Date()) =>
    listing.status === LISTING_STATUS.ACTIVE && !isHidden(listing) && listing.expiresAt > now;

// What to show as the status: an active listing past its expiry date already reads as expired.
export const effectiveStatus = (listing, now = new Date()) =>
    listing.status === LISTING_STATUS.ACTIVE && listing.expiresAt <= now ? LISTING_STATUS.EXPIRED : listing.status;
