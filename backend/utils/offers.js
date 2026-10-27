import Conversation from "../models/conversation.model.js";
import Listing from "../models/listing.model.js";
import Offer from "../models/offer.model.js";
import ApiError from "./ApiError.js";
import { inBatches } from "./batch.js";
import { sameId } from "./ids.js";
import { notify } from "./notify.js";
import { chatRoleOf } from "./roles.js";
import { postMessage } from "./chat.js";
import { toOfferShape } from "./chatShapes.js";
import { expireListingCircles } from "./swapCircles.js";
import { emitToUsers } from "../socket/index.js";
import { OFFER_LIFETIME_HOURS, OFFER_STATUS, PRICED_TYPES } from "../config/constants.js";

export const offerExpiry = (from = new Date()) => new Date(from.getTime() + OFFER_LIFETIME_HOURS * 60 * 60 * 1000);

const fieldError = (field, message) => new ApiError(400, message, { errors: { [field]: message } });

// What an offer may contain depends on the listing type. Returns the cleaned-up terms or throws a 400
// the form can show. Free items are requests (always ₹0); a swap says what's offered in exchange;
// rent is a price per period plus how many periods.
export const offerTerms = (listingType, { amount, periods, note = "" }) => {
    if (listingType === "free") return { amount: 0, periods: 1, note };
    if (listingType === "swap" && note.length < 2) throw fieldError("note", "What are you offering in exchange?");
    if (PRICED_TYPES.includes(listingType) && !(amount >= 1)) throw fieldError("amount", "Enter an amount");
    return { amount: amount ?? 0, periods: listingType === "rent" ? periods ?? 1 : 1, note };
};

// ── Notification copy ─────────────────────────────────────

const rupees = (amount) => `₹${amount.toLocaleString("en-IN")}`;

export const firstName = (name = "") => name.split(" ")[0] || "Someone";

export const chatLink = (conversationId) => `/inbox/${conversationId}`;

export const dealLink = (dealId) => `/deals/${dealId}`;

export const coverOf = (listing) => listing?.images?.[0]?.url ?? "";

// "₹350", "₹20/day × 3 (₹60)", "a swap: my DBMS book", "₹0".
export const describeTerms = (offer, listing) => {
    if (listing?.type === "swap") return offer.amount > 0 ? `a swap (${offer.note}) + ${rupees(offer.amount)}` : `a swap: ${offer.note}`;
    if (listing?.type === "rent") {
        const total = rupees(offer.amount * offer.periods);
        return `${rupees(offer.amount)}/${listing.rentPeriod ?? "period"} × ${offer.periods} (${total})`;
    }
    return rupees(offer.amount);
};

// Why an offer was cancelled, as the end of "The listing …". Moderation reasons stay vague on purpose.
const CANCEL_REASONS_COPY = {
    reserved: "was reserved for someone else",
    sold: "was marked as sold",
    deleted: "was deleted",
    expired: "expired",
    unavailable: "is no longer available"
};

// ── Offer lifecycle ───────────────────────────────────────

// Runs once an offer stops being pending, whatever the reason: clears the chat's activeOffer pointer
// (only if it still points at this offer), posts the system message and refreshes the offer card on
// both screens. `actorId` is who caused it (left out for the system); `unreadFor` limits whose unread
// counter moves (see postMessage). Returns the conversation.
export const settleOffer = async (offer, { event, data = {}, actorId = null, unreadFor }) => {
    await Conversation.updateOne({ _id: offer.conversation, activeOffer: offer._id }, { activeOffer: null });
    const conversation = await Conversation.findById(offer.conversation).lean();
    if (!conversation) return null;

    await postMessage(conversation, { type: "system", system: { event, data: { offerId: offer._id, ...data } } }, { actorId, unreadFor });
    emitToUsers(conversation.participants, "offer:update", { conversationId: conversation._id, offer: toOfferShape(offer) });
    return conversation;
};

// Lazy expiry: an offer past its expiry date is closed the moment someone acts on it or makes a new
// offer in the same chat (the Chunk 6 job does the same for offers nobody touches). Returns the
// expired offer, or null when it wasn't due or something else closed it first.
export const expireOffer = async (offer) => {
    const now = new Date();
    const expired = await Offer.findOneAndUpdate(
        { _id: offer._id, status: OFFER_STATUS.PENDING, expiresAt: { $lte: now } },
        { $set: { status: OFFER_STATUS.EXPIRED, respondedAt: now }, $push: { history: { by: null, action: "expired", at: now } } },
        { returnDocument: "after" }
    );
    if (!expired) return null;

    // No actor: nobody caused it, so both people get an unread bump.
    await settleOffer(expired, { event: "offer_expired" });
    const listing = await Listing.findById(expired.listing).select("title images").lean();
    await notify(expired.proposedBy, {
        type: "offer_expired",
        title: "Offer expired",
        body: `Your offer for “${listing?.title ?? "a listing"}” expired without a reply.`,
        link: chatLink(expired.conversation),
        image: coverOf(listing)
    });
    return expired;
};

// Closes every open negotiation on a listing once it stops being available: reserved for a deal,
// sold, deleted, expired, flagged, removed, or its owner banned. Each pending offer is cancelled with
// its own conditional update, so an offer that is accepted or withdrawn at the same moment is left
// alone. An offer already past its expiry date reads as expired everywhere (lazy expiry), so it isn't
// re-closed and announced either. Every offer is in its own chat, so they're handled side by side: one
// after another, a listing with dozens of offers could keep the request waiting for many seconds.
// `actorId` is the user whose action caused this (never bumped or notified); leave it out for
// system causes. Returns how many offers were cancelled.
export const closeListingNegotiations = async (listingId, { reason, keepOfferId = null, keepCircleId = null, actorId = null } = {}) => {
    const pending = await Offer.find({ listing: listingId, status: OFFER_STATUS.PENDING, expiresAt: { $gt: new Date() }, _id: { $ne: keepOfferId } })
        .select("buyer seller")
        .lean();
    const listing = pending.length > 0 ? await Listing.findById(listingId).select("title images").lean() : null;

    const cancelled = await inBatches(pending, async ({ _id, buyer, seller }) => {
        const now = new Date();
        // The history only names someone from this chat; whoever got the item elsewhere stays private.
        const by = sameId(buyer, actorId) || sameId(seller, actorId) ? actorId : null;
        const offer = await Offer.findOneAndUpdate(
            { _id, status: OFFER_STATUS.PENDING, expiresAt: { $gt: now } },
            { $set: { status: OFFER_STATUS.CANCELLED, respondedAt: now }, $push: { history: { by, action: "cancelled", reason, at: now } } },
            { returnDocument: "after" }
        );
        if (!offer) return false;

        // Only the visitor, who just lost out, gets an unread bump: it's the owner's own listing that
        // changed (and whoever caused it is never bumped anyway).
        const conversation = await settleOffer(offer, { event: "offer_cancelled", data: { reason }, actorId, unreadFor: ["visitor"] });
        // The visitor is told; the owner always knows already (they caused it, or hear about it
        // separately). The notification shows the listing's owner, whoever triggered it.
        if (conversation) {
            await notify(conversation.visitor, {
                type: "offer_cancelled",
                title: "Offer cancelled",
                body: `The offer on “${listing?.title ?? "a listing"}” was cancelled: the listing ${CANCEL_REASONS_COPY[reason] ?? "isn't available right now"}.`,
                link: chatLink(conversation._id),
                actor: conversation.owner,
                image: coverOf(listing)
            });
        }
        return true;
    });

    await expireListingCircles(listingId, { keepCircleId, reason });
    return cancelled.filter(Boolean).length;
};

// After a block: every pending offer in the pair's `conversations` (each with owner and visitor) is
// cancelled. The chat only says the item "is no longer available", with no actor, and only the
// blocked person's unread counter moves (the blocker did it), so the block itself is never revealed.
// Nobody is notified. Returns how many offers were cancelled.
export const cancelOffersBetween = async (conversations, { blockedId }) => {
    const pending = await Offer.find({ conversation: { $in: conversations.map((c) => c._id) }, status: OFFER_STATUS.PENDING })
        .select("conversation")
        .lean();

    let cancelled = 0;
    for (const { _id, conversation: conversationId } of pending) {
        const now = new Date();
        const offer = await Offer.findOneAndUpdate(
            { _id, status: OFFER_STATUS.PENDING },
            { $set: { status: OFFER_STATUS.CANCELLED, respondedAt: now }, $push: { history: { by: null, action: "cancelled", reason: "unavailable", at: now } } },
            { returnDocument: "after" }
        );
        if (!offer) continue;
        cancelled += 1;

        const conversation = conversations.find((c) => sameId(c._id, conversationId));
        await settleOffer(offer, { event: "offer_cancelled", data: { reason: "unavailable" }, unreadFor: [chatRoleOf(conversation, blockedId)] });
    }
    return cancelled;
};
