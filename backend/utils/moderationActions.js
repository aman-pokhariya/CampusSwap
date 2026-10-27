import Conversation from "../models/conversation.model.js";
import Deal from "../models/deal.model.js";
import Listing from "../models/listing.model.js";
import Offer from "../models/offer.model.js";
import User from "../models/user.model.js";
import { inBatches } from "./batch.js";
import { sameId } from "./ids.js";
import { notify } from "./notify.js";
import { counterpartOf } from "./roles.js";
import { releaseListing } from "./reservations.js";
import { emitDealUpdate } from "./deals.js";
import { toOfferShape } from "./chatShapes.js";
import { cancelSwapCircle } from "./swapCircles.js";
import { announceListingChange, emitUnread, postMessage } from "./chat.js";
import { chatLink, closeListingNegotiations, coverOf, dealLink, settleOffer } from "./offers.js";
import { disconnectUser, emitToUsers } from "../socket/index.js";
import { DEAL_STATUS, LISTING_STATUS, MODERATION_STATE, OFFER_STATUS } from "../config/constants.js";

// What an admin's decision does to listings, deals, offers and accounts (controllers/admin.controllers.js).
// Like every other state change, each step is a conditional update that names the state it expects, so a
// decision racing a student's own action (or another admin's) never undoes it, and running one twice is safe.

const { FLAGGED, OK, REMOVED } = MODERATION_STATE;

// ── Deals and offers nobody in them ended ─────────────────

// Cancels open deals that neither person chose to end: the listing was removed, or one of them was
// suspended. cancelledBy stays null, so nobody's trust score pays for it. Each listing goes back on sale
// only while that deal still holds it (A2); a removed one stays hidden. The chat says so with no actor
// (news for both), and everyone except `skipUserId` is notified: the owner hears about a removal
// separately, and a suspended account isn't told anything.
const cancelDealsBySystem = async (filter, { note, why, skipUserId }) => {
    const open = await Deal.find({ ...filter, isOpen: true }).select("_id").lean();

    for (const { _id } of open) {
        const now = new Date();
        const cancelled = await Deal.findOneAndUpdate(
            { _id, isOpen: true },
            {
                $set: { status: DEAL_STATUS.CANCELLED, isOpen: false, cancelledBy: null, cancelReason: "other", cancelNote: note, cancelledAt: now },
                $unset: { "handover.codeHash": 1, "handover.tokenHash": 1 }
            },
            { returnDocument: "after" }
        ).lean();
        if (!cancelled) continue; // completed or cancelled a moment ago

        const released = await releaseListing(cancelled.listing, cancelled._id);

        // The offer that became this deal is closed too, and its card in the chat says so.
        if (cancelled.offer) {
            const offer = await Offer.findOneAndUpdate(
                { _id: cancelled.offer, status: OFFER_STATUS.ACCEPTED },
                {
                    $set: { status: OFFER_STATUS.CANCELLED, respondedAt: now },
                    $push: { history: { by: null, action: "cancelled", reason: "deal_cancelled", at: now } }
                },
                { returnDocument: "after" }
            ).lean();
            if (offer) emitToUsers([cancelled.buyer, cancelled.seller], "offer:update", { conversationId: offer.conversation, offer: toOfferShape(offer) });
        }

        const conversation = cancelled.conversation && (await Conversation.findById(cancelled.conversation).lean());
        if (conversation) {
            await postMessage(conversation, { type: "system", system: { event: "deal_cancelled", data: { dealId: cancelled._id, reason: "other", note } } });
        }
        for (const userId of [cancelled.buyer, cancelled.seller].filter((id) => !sameId(id, skipUserId))) {
            await notify(userId, {
                type: "deal_cancelled",
                title: "Deal cancelled",
                body: `The deal for “${cancelled.title}” was cancelled: ${why}.`,
                link: dealLink(cancelled._id),
                image: cancelled.cover
            });
        }

        if (released) await announceListingChange(released);
        await emitDealUpdate(cancelled._id);
        await Promise.all([emitUnread(cancelled.buyer), emitUnread(cancelled.seller)]);
        if (cancelled.swapCircle) await cancelSwapCircle(cancelled.swapCircle, "deal_cancelled");
    }
};

// A suspended student's pending offers in other people's chats (the ones on their own listings closed
// with those listings). Each chat says the offer was cancelled, and the other person is told why.
const cancelOffersOf = async (userId) => {
    const pending = await Offer.find({ $or: [{ buyer: userId }, { seller: userId }], status: OFFER_STATUS.PENDING, expiresAt: { $gt: new Date() } })
        .select("_id")
        .lean();

    await inBatches(pending, async ({ _id }) => {
        const now = new Date();
        const offer = await Offer.findOneAndUpdate(
            { _id, status: OFFER_STATUS.PENDING, expiresAt: { $gt: now } },
            { $set: { status: OFFER_STATUS.CANCELLED, respondedAt: now }, $push: { history: { by: null, action: "cancelled", reason: "unavailable", at: now } } },
            { returnDocument: "after" }
        );
        if (!offer) return;

        const conversation = await settleOffer(offer, { event: "offer_cancelled", data: { reason: "unavailable" } });
        const listing = await Listing.findById(offer.listing).select("title images").lean();
        await notify(counterpartOf(offer, userId), {
            type: "offer_cancelled",
            title: "Offer cancelled",
            body: `The offer on “${listing?.title ?? "a listing"}” was cancelled: the other student is no longer on CampusSwap.`,
            link: conversation ? chatLink(conversation._id) : "",
            image: coverOf(listing)
        });
    });
};

// ── Listings ──────────────────────────────────────────────

// Hides a listing for good (moderation "removed"). The source and time are overwritten with the admin's,
// so the auto-flag brake, which counts listings that reports hid in the last hour (utils/reports.js), only
// counts what reports did. Its open deal is cancelled without blaming anyone, every negotiation closes,
// its chats update and the owner is told why (`notifyOwner: false` for a suspended owner).
// Returns the listing, or null when it was already removed or its owner deleted it.
export const removeListing = async (listingId, { reason, notifyOwner = true }) => {
    const removed = await Listing.findOneAndUpdate(
        { _id: listingId, "moderation.state": { $ne: REMOVED }, deletedAt: null },
        { $set: { "moderation.state": REMOVED, "moderation.source": "admin", "moderation.reason": reason, "moderation.at": new Date() } },
        { returnDocument: "after" }
    ).lean();
    if (!removed) return null;

    await announceListingChange(removed);
    await cancelDealsBySystem({ listing: removed._id }, { note: "listing removed", why: "the listing is no longer available", skipUserId: removed.seller });
    await closeListingNegotiations(removed._id, { reason: "removed" });

    if (notifyOwner) {
        await notify(removed.seller, {
            type: "listing_removed",
            title: "Your listing was removed",
            body: `A moderator removed “${removed.title}”. Reason: ${reason}.`,
            link: `/listings/${removed._id}`,
            image: coverOf(removed)
        });
    }
    return removed;
};

// Makes a flagged or removed listing visible again. Its lifecycle status stays as it is (a reserved
// listing is still reserved for its deal), its chats and open deal update, and the owner is told.
// `onlyIfFlaggedBy: "reports"` restores it only while reports are what hid it.
// Returns the listing, or null when moderation wasn't hiding it.
export const restoreListing = async (listingId, { onlyIfFlaggedBy } = {}) => {
    const hiddenBy = onlyIfFlaggedBy
        ? { "moderation.state": FLAGGED, "moderation.source": onlyIfFlaggedBy }
        : { "moderation.state": { $in: [FLAGGED, REMOVED] } };

    const restored = await Listing.findOneAndUpdate(
        { _id: listingId, ...hiddenBy, deletedAt: null },
        { $set: { "moderation.state": OK, "moderation.source": "admin", "moderation.at": new Date() }, $unset: { "moderation.reason": 1 } },
        { returnDocument: "after" }
    ).lean();
    if (!restored) return null;

    await announceListingChange(restored);
    const openDeal = await Deal.findOne({ listing: restored._id, isOpen: true }).select("_id").lean();
    if (openDeal) await emitDealUpdate(openDeal._id);

    await notify(restored.seller, {
        type: "listing_restored",
        title: "Your listing is visible again",
        body: `A moderator checked “${restored.title}”: everyone can see it again.`,
        link: `/listings/${restored._id}`,
        image: coverOf(restored)
    });
    return restored;
};

// ── Accounts ──────────────────────────────────────────────

// Suspends an account. From this moment isAuthenticated, login and the socket server refuse it, and its
// open tabs are told straight away (session:ended). Then everything it had going is wound down without
// blaming anyone else: its live listings (active or reserved) are removed, its open deals cancelled
// (their listings go back on sale) and its pending offers in other people's chats cancelled. Running it
// again only touches what's still open, which also finishes an earlier run that stopped halfway.
// Returns the user, or null if there's no such account.
export const banUser = async (userId) => {
    const user = await User.findOneAndUpdate({ _id: userId }, { $set: { isBanned: true } }, { returnDocument: "after" }).select("_id").lean();
    if (!user) return null;
    disconnectUser(user._id, { notify: true, reason: "banned" });

    const listings = await Listing.find({
        seller: user._id,
        status: { $in: [LISTING_STATUS.ACTIVE, LISTING_STATUS.RESERVED] },
        "moderation.state": { $ne: REMOVED },
        deletedAt: null
    })
        .select("_id")
        .lean();
    for (const { _id } of listings) await removeListing(_id, { reason: "The account was suspended", notifyOwner: false });

    await cancelDealsBySystem(
        { $or: [{ buyer: user._id }, { seller: user._id }] },
        { note: "account no longer active", why: "the other student's account is no longer active", skipUserId: user._id }
    );
    await cancelOffersOf(user._id);
    return user;
};
