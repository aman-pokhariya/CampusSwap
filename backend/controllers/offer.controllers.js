import mongoose from "mongoose";
import Conversation from "../models/conversation.model.js";
import Deal from "../models/deal.model.js";
import Listing from "../models/listing.model.js";
import Offer from "../models/offer.model.js";
import User from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import { notify } from "../utils/notify.js";
import { bumpStat } from "../utils/stats.js";
import { isBlockedPair } from "../utils/blocks.js";
import { sameId } from "../utils/ids.js";
import { discoverable, isDiscoverable } from "../utils/listingVisibility.js";
import { claimListingTerms } from "../utils/listingTerms.js";
import { counterpartOf, dealRoleOf, otherDealRole } from "../utils/roles.js";
import { releaseListing, reserveListing } from "../utils/reservations.js";
import { announceListingChange, emitUnread, findConversationFor, postMessage } from "../utils/chat.js";
import { isOfferExpired, toMessageShape, toOfferShape } from "../utils/chatShapes.js";
import { DEAL_POPULATE, emitDealCards, toDealCard } from "../utils/deals.js";
import { emitToUsers } from "../socket/index.js";
import {
    chatLink,
    closeListingNegotiations,
    coverOf,
    dealLink,
    describeTerms,
    expireOffer,
    firstName,
    offerExpiry,
    offerTerms,
    settleOffer
} from "../utils/offers.js";
import { OFFER_STATUS, PRICED_TYPES } from "../config/constants.js";

// Every state change below is one conditional update that names the state it expects
// ({ status: "pending", awaiting: me, expiresAt: { $gt: now } }). If it matches nothing, someone
// else got there first and the request fails with a 409 instead of overwriting their change.

const unavailable = () => new ApiError(409, "This item is no longer available", { code: "LISTING_UNAVAILABLE" });

const blockedError = () => new ApiError(403, "You can't make or answer offers with this person", { code: "BLOCKED" });

// Re-reads an offer after a conditional update missed, to say what changed.
const staleOfferError = async (offerId) => {
    const offer = await Offer.findById(offerId).lean();
    if (offer && isOfferExpired(offer)) return new ApiError(409, "This offer has expired", { code: "OFFER_EXPIRED" });
    if (offer?.status !== OFFER_STATUS.PENDING) return new ApiError(409, "This offer is no longer open", { code: "OFFER_CLOSED" });
    return new ApiError(409, "This offer just changed — take another look", { code: "OFFER_CHANGED" });
};

const historyEntry = (by, action, offer, extra = {}) => ({
    by,
    action,
    amount: offer.amount,
    periods: offer.periods,
    at: new Date(),
    ...extra
});

// ── Make an offer ─────────────────────────────────────────

export const createOffer = async (req, res) => {
    const conversation = await findConversationFor(req.params.id, req.user);
    const me = req.user._id;
    const otherId = counterpartOf(conversation, me);

    if (await isBlockedPair(me, otherId)) throw blockedError();

    const listing = await Listing.findById(conversation.listing).lean();
    if (!listing || !isDiscoverable(listing)) throw unavailable();

    const terms = offerTerms(listing.type, req.body);

    // One open offer per chat. An expired one is closed first so it doesn't block a new offer.
    const current = await Offer.findOne({ conversation: conversation._id, status: OFFER_STATUS.PENDING }).lean();
    if (current && !isOfferExpired(current)) {
        throw new ApiError(409, "There's already an offer waiting for a reply", { code: "OFFER_PENDING" });
    }
    if (current) await expireOffer(current);

    // The offer is read in the listing's current type and rent period ("₹40/day × 7"), so it's only made
    // while they're still the ones read above: an edit changing them at this moment makes one of the two fail.
    await claimListingTerms(listing, unavailable);

    const myRole = dealRoleOf(conversation, me);
    const now = new Date();
    let offer;
    try {
        offer = await Offer.create({
            listing: listing._id,
            conversation: conversation._id,
            // Roles come from the conversation, frozen when it started.
            buyer: conversation.buyer,
            seller: conversation.seller,
            ...terms,
            awaiting: otherDealRole(myRole),
            proposedBy: me,
            history: [{ by: me, action: "offered", ...terms, at: now }],
            expiresAt: offerExpiry(now)
        });
    } catch (err) {
        // The partial unique index: someone made an offer in this chat a moment ago.
        if (err.code === 11000) throw new ApiError(409, "There's already an offer waiting for a reply", { code: "OFFER_PENDING" });
        throw err;
    }

    // The listing may have been sold, deleted or reserved since the check above. The offer is written
    // first and the listing checked second, while the listing side saves its status before it looks for
    // pending offers (closeListingNegotiations), so one of the two always sees the other. If nothing is
    // deleted here, that side cancelled the offer already. No message was posted yet: nothing else to undo.
    if (!(await Listing.exists({ _id: listing._id, ...discoverable() }))) {
        await Offer.deleteOne({ _id: offer._id, status: OFFER_STATUS.PENDING });
        throw unavailable();
    }

    let message;
    try {
        message = await postMessage(conversation, { sender: me, type: "offer", offer: offer._id }, { actorId: me, set: { activeOffer: offer._id } });
    } catch (err) {
        await Offer.deleteOne({ _id: offer._id }); // compensate: an offer nobody can see must not block new ones
        throw err;
    }
    emitToUsers(conversation.participants, "offer:update", { conversationId: conversation._id, offer: toOfferShape(offer) });

    await notify(otherId, {
        type: "offer_received",
        title: `New offer on “${listing.title}”`,
        body: listing.type === "free"
            ? `${firstName(req.user.name)} would like it`
            : `${firstName(req.user.name)} offered ${describeTerms(offer, listing)}`,
        link: chatLink(conversation._id),
        actor: me,
        image: coverOf(listing)
    });
    await bumpStat(listing, "offers");

    return res.status(201).json({ success: true, offer: toOfferShape(offer), message: toMessageShape(message) });
};

export const getOffers = async (req, res) => {
    const conversation = await findConversationFor(req.params.id, req.user);
    const offers = await Offer.find({ conversation: conversation._id }).sort({ createdAt: -1 }).limit(50).lean();
    return res.json({ success: true, offers: offers.map(toOfferShape) });
};

// ── Respond: accept · counter · decline · withdraw ────────

const acceptOffer = async ({ offer, conversation, user, myRole }) => {
    const now = new Date();
    // Generated up front so the listing can point at the deal before the deal exists.
    const dealId = new mongoose.Types.ObjectId();

    // 1. Claim the offer. Of two accepts racing each other, only one matches.
    const accepted = await Offer.findOneAndUpdate(
        { _id: offer._id, status: OFFER_STATUS.PENDING, awaiting: myRole, expiresAt: { $gt: now } },
        { $set: { status: OFFER_STATUS.ACCEPTED, respondedAt: now, deal: dealId }, $push: { history: historyEntry(user._id, "accepted", offer) } },
        { returnDocument: "after" }
    );
    if (!accepted) throw await staleOfferError(offer._id);

    // Undoes step 1 when a later step fails: the offer is cancelled and both screens update.
    const cancelAccepted = async () => {
        const cancelled = await Offer.findOneAndUpdate(
            { _id: accepted._id, status: OFFER_STATUS.ACCEPTED, deal: dealId },
            {
                $set: { status: OFFER_STATUS.CANCELLED, respondedAt: new Date() },
                $unset: { deal: 1 },
                $push: { history: historyEntry(null, "cancelled", accepted, { reason: "unavailable" }) }
            },
            { returnDocument: "after" }
        );
        if (cancelled) await settleOffer(cancelled, { event: "offer_cancelled", data: { reason: "unavailable" }, actorId: user._id });
    };

    // 2. Reserve the listing for this deal. Fails if it was reserved, sold, hidden or expired meanwhile.
    const listing = await reserveListing(accepted.listing, dealId);
    if (!listing) {
        await cancelAccepted();
        throw unavailable();
    }

    // 3. Create the deal under the id the reservation already points at.
    let deal;
    try {
        const hostels = await User.find({ _id: { $in: [accepted.buyer, accepted.seller] } }).select("hostel").lean();
        const hostelOf = (id) => hostels.find((u) => sameId(u._id, id))?.hostel ?? "";
        deal = await Deal.create({
            _id: dealId,
            listing: listing._id,
            conversation: conversation._id,
            offer: accepted._id,
            buyer: accepted.buyer,
            seller: accepted.seller,
            campus: listing.campus,
            amount: accepted.amount * accepted.periods,
            periods: accepted.periods,
            listingType: listing.type,
            category: listing.category,
            title: listing.title,
            cover: coverOf(listing),
            sellerHostel: hostelOf(accepted.seller),
            buyerHostel: hostelOf(accepted.buyer)
        });
    } catch (err) {
        // Compensate steps 1 and 2: free the listing (only if this deal still holds it) and close the offer.
        await releaseListing(listing._id, dealId);
        await cancelAccepted();
        // The one-open-deal-per-listing index: another deal already holds this item.
        if (err.code === 11000) throw unavailable();
        throw err;
    }

    // 4. Point the chat at its deal; the offer stops being the open one.
    await Conversation.updateOne({ _id: conversation._id }, { deal: dealId });
    await settleOffer(accepted, { event: "offer_accepted", data: { dealId, amount: deal.amount, periods: deal.periods }, actorId: user._id });

    // 5. Nobody else can get it now: close every other negotiation on the listing.
    await closeListingNegotiations(listing._id, { reason: "reserved", keepOfferId: accepted._id, actorId: user._id });

    // 6. Tell everyone, all at once (none of these depend on each other). The deal card is loaded once,
    // for the live update and for this response.
    const what = listing.type === "free" ? "your request" : describeTerms(accepted, listing);
    const [card] = await Promise.all([
        Deal.findById(dealId).populate(DEAL_POPULATE).lean(),
        notify(accepted.proposedBy, {
            type: "offer_accepted",
            title: "Offer accepted 🎉",
            body: `${firstName(user.name)} accepted ${what} for “${listing.title}”. Next, agree on a meetup.`,
            link: dealLink(dealId),
            actor: user._id,
            image: coverOf(listing)
        }),
        announceListingChange(listing),
        emitUnread(deal.buyer),
        emitUnread(deal.seller)
    ]);
    emitDealCards(card);

    return { message: "Offer accepted — it's a deal! 🎉", offer: toOfferShape(accepted), deal: toDealCard(card, user._id) };
};

const counterOffer = async ({ offer, conversation, user, myRole, body }) => {
    const listing = await Listing.findById(offer.listing).lean();
    if (!listing || !isDiscoverable(listing)) throw unavailable();
    if (body.amount === undefined && PRICED_TYPES.includes(listing.type)) {
        throw new ApiError(400, "Enter your counter amount", { errors: { amount: "Enter your counter amount" } });
    }

    const terms = offerTerms(listing.type, {
        amount: body.amount ?? offer.amount,
        periods: body.periods ?? offer.periods,
        // A swap's note is part of its terms (what's given in exchange); any other note was the
        // previous proposer's own message, so the counter doesn't repeat it as mine.
        note: body.note ?? (listing.type === "swap" ? offer.note : "")
    });
    const now = new Date();

    // The turn flips to the other person, and they get a fresh 48 hours to answer.
    const countered = await Offer.findOneAndUpdate(
        { _id: offer._id, status: OFFER_STATUS.PENDING, awaiting: myRole, expiresAt: { $gt: now } },
        {
            $set: { ...terms, awaiting: otherDealRole(myRole), proposedBy: user._id, expiresAt: offerExpiry(now) },
            $push: { history: { by: user._id, action: "countered", ...terms, at: now } }
        },
        { returnDocument: "after" }
    );
    if (!countered) throw await staleOfferError(offer._id);

    await postMessage(
        conversation,
        { type: "system", system: { event: "offer_countered", data: { offerId: countered._id, ...terms } } },
        { actorId: user._id }
    );
    emitToUsers(conversation.participants, "offer:update", { conversationId: conversation._id, offer: toOfferShape(countered) });
    await notify(counterpartOf(offer, user._id), {
        type: "offer_countered",
        title: `Counter offer on “${listing.title}”`,
        body: listing.type === "free"
            ? `${firstName(user.name)} replied to the request`
            : `${firstName(user.name)} countered with ${describeTerms(countered, listing)}`,
        link: chatLink(conversation._id),
        actor: user._id,
        image: coverOf(listing)
    });

    return { message: "Counter offer sent", offer: toOfferShape(countered) };
};

// Decline (by the person whose turn it is) and withdraw (by whoever made the latest proposal).
const closeOffer = ({ status, event, title, verb, message }) => async ({ offer, conversation, user, myRole }) => {
    const now = new Date();
    const actorFilter = status === OFFER_STATUS.WITHDRAWN ? { proposedBy: user._id } : { awaiting: myRole };

    const closed = await Offer.findOneAndUpdate(
        { _id: offer._id, status: OFFER_STATUS.PENDING, expiresAt: { $gt: now }, ...actorFilter },
        { $set: { status, respondedAt: now }, $push: { history: historyEntry(user._id, status, offer) } },
        { returnDocument: "after" }
    );
    if (!closed) throw await staleOfferError(offer._id);

    await settleOffer(closed, { event, actorId: user._id });
    const listing = await Listing.findById(offer.listing).select("title images").lean();
    await notify(counterpartOf(offer, user._id), {
        type: event,
        title,
        body: `${firstName(user.name)} ${verb} for “${listing?.title ?? "a listing"}”.`,
        link: chatLink(conversation._id),
        actor: user._id,
        image: coverOf(listing)
    });

    return { message, offer: toOfferShape(closed) };
};

const ACTIONS = {
    accept: acceptOffer,
    counter: counterOffer,
    decline: closeOffer({
        status: OFFER_STATUS.DECLINED,
        event: "offer_declined",
        title: "Offer declined",
        verb: "declined your offer",
        message: "Offer declined"
    }),
    withdraw: closeOffer({
        status: OFFER_STATUS.WITHDRAWN,
        event: "offer_withdrawn",
        title: "Offer withdrawn",
        verb: "withdrew their offer",
        message: "Offer withdrawn"
    })
};

export const respondToOffer = async (req, res) => {
    const { id } = req.params;
    const { action } = req.body;
    const me = req.user._id;

    if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Offer not found");
    const offer = await Offer.findById(id).lean();
    const conversation = offer && (await Conversation.findOne({ _id: offer.conversation, participants: me }).lean());
    if (!conversation) throw new ApiError(404, "Offer not found");

    // Authorise against what we just read; the conditional update in each action re-checks it atomically.
    if (await isBlockedPair(me, counterpartOf(offer, me))) throw blockedError();
    if (offer.status !== OFFER_STATUS.PENDING) throw new ApiError(409, "This offer is no longer open", { code: "OFFER_CLOSED" });
    if (isOfferExpired(offer)) {
        await expireOffer(offer);
        throw new ApiError(409, "This offer has expired", { code: "OFFER_EXPIRED" });
    }

    const myRole = dealRoleOf(offer, me);
    if (action === "withdraw" && !sameId(offer.proposedBy, me)) {
        throw new ApiError(403, "Only the person who made this offer can withdraw it", { code: "NOT_YOUR_OFFER" });
    }
    if (action !== "withdraw" && offer.awaiting !== myRole) {
        throw new ApiError(403, "It's the other person's turn to reply", { code: "NOT_YOUR_TURN" });
    }

    const { message, ...result } = await ACTIONS[action]({ offer, conversation, user: req.user, myRole, body: req.body });
    return res.json({ success: true, message, ...result });
};
