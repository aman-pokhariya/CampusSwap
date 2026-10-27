import mongoose from "mongoose";
import Campus from "../models/campus.model.js";
import Conversation from "../models/conversation.model.js";
import Deal from "../models/deal.model.js";
import Listing from "../models/listing.model.js";
import Offer from "../models/offer.model.js";
import Review from "../models/review.model.js";
import ApiError from "../utils/ApiError.js";
import { canAdminCampus } from "../utils/admin.js";
import { isBlockedPair } from "../utils/blocks.js";
import { sameId } from "../utils/ids.js";
import { notify } from "../utils/notify.js";
import { findPageBefore } from "../utils/paginate.js";
import { isHidden } from "../utils/listingVisibility.js";
import { counterpartOf, dealRoleOf } from "../utils/roles.js";
import { releaseListing } from "../utils/reservations.js";
import { handoverHash, newHandover } from "../utils/handover.js";
import { recomputeTrust } from "../utils/trust.js";
import { REVIEW_POPULATE, toReviewShape } from "../utils/reviews.js";
import { cancelSwapCircle, checkSwapCircleCompletion } from "../utils/swapCircles.js";
import { announceListingChange, emitUnread, postMessage } from "../utils/chat.js";
import { toOfferShape } from "../utils/chatShapes.js";
import { dealLink, firstName } from "../utils/offers.js";
import { DEAL_POPULATE, dealDetailFor, emitDealUpdate, toDealCard, toDealDetail } from "../utils/deals.js";
import { emitToUsers } from "../socket/index.js";
import { DEAL_STATUS, LISTING_STATUS, MAX_HANDOVER_ATTEMPTS, OFFER_STATUS, RENT_PERIOD_DAYS } from "../config/constants.js";

// Every action below is one conditional update that names the state it expects ({ _id, isOpen: true, … }).
// If it matches nothing, the deal is re-read to say why (403/404/409) instead of overwriting whatever
// changed. Responses and socket events are built by toDealCard, so the handover hashes never leave.

const DAY_MS = 24 * 60 * 60 * 1000;

const STATUS_FILTERS = {
    active: { isOpen: true },
    completed: { status: DEAL_STATUS.COMPLETED },
    cancelled: { status: DEAL_STATUS.CANCELLED },
    all: {}
};

// Why a deal was cancelled, as the other person's notification puts it ("other" adds nothing).
const CANCEL_REASON_COPY = {
    changed_mind: "they changed their mind",
    found_another: "they found another option",
    no_show: "the meetup didn't happen",
    not_as_described: "the item wasn't as described"
};

const asParticipant = (userId) => ({ $or: [{ buyer: userId }, { seller: userId }] });

// "Tue, 5 Nov, 5:30 pm" in India time, whichever timezone the server runs in.
const meetupTime = (at) =>
    new Date(at).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit"
    });

// A rental is due back after its last period.
const rentedUntil = (from, periods, rentPeriod) => new Date(from.getTime() + periods * (RENT_PERIOD_DAYS[rentPeriod] ?? 1) * DAY_MS);

// ── Errors ────────────────────────────────────────────────

const closedError = (deal) =>
    new ApiError(409, deal.status === DEAL_STATUS.COMPLETED ? "This deal is already completed" : "This deal was cancelled", { code: "DEAL_CLOSED" });

const blockedError = () => new ApiError(403, "You can't plan meetups with this person", { code: "BLOCKED" });

// Re-reads a deal after a conditional update matched nothing, to say what changed. `explain` adds
// the action's own reasons when the deal is still open.
const staleDealError = async (dealId, explain = () => null) => {
    const current = await Deal.findById(dealId).lean();
    if (!current) return new ApiError(404, "Deal not found");
    if (!current.isOpen) return closedError(current);
    return explain(current) ?? new ApiError(409, "This deal just changed — take another look", { code: "DEAL_CHANGED" });
};

// ── Loading and checks ────────────────────────────────────

// A deal one of its two participants wants to act on. Anyone else gets a 404, so ids can't be probed;
// campus admins may look at a deal (GET /:id) but not act on it.
const findDealToAct = async (id, user) => {
    if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Deal not found");

    const deal = await Deal.findById(id).lean();
    if (deal && dealRoleOf(deal, user._id)) return deal;
    if (deal && canAdminCampus(user, deal.campus)) {
        throw new ApiError(403, "Only the buyer and the seller can do this", { code: "NOT_PARTICIPANT" });
    }
    throw new ApiError(404, "Deal not found");
};

// Meetups, the handover and completing wait while the listing is under review. Cancelling never does.
const assertListingAvailable = async (deal) => {
    const listing = await Listing.findById(deal.listing).select("rentPeriod moderation deletedAt").lean();
    if (!listing || listing.deletedAt) throw new ApiError(409, "This listing is no longer available", { code: "LISTING_UNAVAILABLE" });
    if (isHidden(listing)) throw new ApiError(409, "This listing is under review", { code: "LISTING_UNDER_REVIEW" });
    return listing;
};

// ── Telling everyone ──────────────────────────────────────

// Posts a deal event (deal_meetup_proposed, deal_completed, …) in the deal's chat.
const postDealEvent = async (deal, event, data, actorId) => {
    const conversation = deal.conversation && (await Conversation.findById(deal.conversation).lean());
    if (!conversation) return;
    await postMessage(conversation, { type: "system", system: { event, data: { dealId: deal._id, ...data } } }, { actorId });
};

// Every change ends here: both participants get their own updated card and Deals badge.
const broadcast = async (deal) => {
    await emitDealUpdate(deal._id);
    await Promise.all([emitUnread(deal.buyer), emitUnread(deal.seller)]);
};

// ── Lists ─────────────────────────────────────────────────

// My deals as buyer or seller, most recently changed first.
export const getDeals = async (req, res) => {
    const { status, before, limit } = req.validatedQuery;
    const me = req.user._id;

    const { rows, hasMore } = await findPageBefore(Deal, { ...asParticipant(me), ...STATUS_FILTERS[status] }, { field: "updatedAt", before, limit });
    await Deal.populate(rows, DEAL_POPULATE);
    const now = new Date();

    return res.json({ success: true, deals: rows.map((deal) => toDealCard(deal, me, now)), hasMore });
};

// Participants, plus admins of the deal's campus.
export const getDeal = async (req, res) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Deal not found");

    const deal = await Deal.findById(id).populate(DEAL_POPULATE).lean();
    if (!deal || !(dealRoleOf(deal, req.user._id) || canAdminCampus(req.user, deal.campus))) throw new ApiError(404, "Deal not found");

    const reviews = await Review.find({ deal: deal._id }).populate(REVIEW_POPULATE).lean();
    return res.json({ success: true, deal: toDealDetail(deal, req.user._id, reviews) });
};

// ── Meetup ────────────────────────────────────────────────

// Either side proposes one of the campus's safe spots and a time. A new proposal replaces the previous
// one (even a confirmed one: "Change") and waits for the other person to confirm it.
export const proposeMeetup = async (req, res) => {
    const me = req.user;
    const deal = await findDealToAct(req.params.id, me);
    if (!deal.isOpen) throw closedError(deal);
    if (await isBlockedPair(me._id, counterpartOf(deal, me._id))) throw blockedError();
    await assertListingAvailable(deal);

    const campus = await Campus.findById(deal.campus).select("safeSpots").lean();
    const spot = campus?.safeSpots.find((place) => sameId(place._id, req.body.spotId));
    if (!spot) {
        throw new ApiError(400, "Pick one of the safe spots on your campus", { errors: { spotId: "Pick one of the safe spots" } });
    }

    const meetup = { spotId: spot._id, spotName: spot.name, at: req.body.at, proposedBy: me._id, confirmed: false };
    const updated = await Deal.findOneAndUpdate(
        { _id: deal._id, isOpen: true, ...asParticipant(me._id) },
        { $set: { meetup, status: DEAL_STATUS.AGREED } },
        { returnDocument: "after" }
    ).lean();
    if (!updated) throw await staleDealError(deal._id);

    await postDealEvent(updated, "deal_meetup_proposed", { spotName: spot.name, at: meetup.at }, me._id);
    await notify(counterpartOf(updated, me._id), {
        type: "deal_meetup_proposed",
        title: "Meetup proposed 📍",
        body: `${firstName(me.name)} suggested ${spot.name}, ${meetupTime(meetup.at)}, for “${updated.title}”.`,
        link: dealLink(updated._id),
        actor: me._id,
        image: updated.cover
    });
    await broadcast(updated);

    return res.json({ success: true, message: "Meetup proposed", deal: await dealDetailFor(updated._id, me._id) });
};

// Only the person who didn't propose it confirms, while that time is still ahead.
export const confirmMeetup = async (req, res) => {
    const me = req.user;
    const deal = await findDealToAct(req.params.id, me);
    if (!deal.isOpen) throw closedError(deal);
    if (await isBlockedPair(me._id, counterpartOf(deal, me._id))) throw blockedError();
    await assertListingAvailable(deal);

    const now = new Date();
    const updated = await Deal.findOneAndUpdate(
        {
            _id: deal._id,
            isOpen: true,
            status: DEAL_STATUS.AGREED,
            ...asParticipant(me._id),
            "meetup.at": { $gt: now },
            "meetup.confirmed": { $ne: true },
            "meetup.proposedBy": { $ne: me._id }
        },
        // $min keeps the first confirmation if the plan changes later (see scheduledAt in the model).
        { $set: { "meetup.confirmed": true, status: DEAL_STATUS.SCHEDULED }, $min: { scheduledAt: now } },
        { returnDocument: "after" }
    ).lean();

    if (!updated) {
        throw await staleDealError(deal._id, ({ meetup }) => {
            if (!meetup?.at) return new ApiError(409, "There's no meetup to confirm yet", { code: "NO_MEETUP" });
            if (meetup.confirmed) return new ApiError(409, "This meetup is already confirmed", { code: "MEETUP_CONFIRMED" });
            if (sameId(meetup.proposedBy, me._id)) {
                return new ApiError(403, "You proposed this one: the other person confirms it", { code: "OWN_PROPOSAL" });
            }
            if (meetup.at <= now) return new ApiError(409, "That time has passed — suggest a new one", { code: "MEETUP_PASSED" });
            return null;
        });
    }

    const { meetup } = updated;
    await postDealEvent(updated, "deal_meetup_confirmed", { spotName: meetup.spotName, at: meetup.at }, me._id);
    await notify(meetup.proposedBy, {
        type: "deal_meetup_confirmed",
        title: "Meetup confirmed ✅",
        body: `${firstName(me.name)} confirmed ${meetup.spotName}, ${meetupTime(meetup.at)}, for “${updated.title}”.`,
        link: dealLink(updated._id),
        actor: me._id,
        image: updated.cover
    });
    await broadcast(updated);

    return res.json({ success: true, message: "Meetup confirmed", deal: await dealDetailFor(updated._id, me._id) });
};

// ── Handover ──────────────────────────────────────────────

// The seller opens (or refreshes) the handover screen: a new QR token and 6-digit code replace the old
// ones, which stop working, with a fresh set of tries. The plain values exist only in this response.
// Allowed between blocked people too, so a deal can still be finished in person.
export const startHandover = async (req, res) => {
    const me = req.user;
    const deal = await findDealToAct(req.params.id, me);
    if (!sameId(deal.seller, me._id)) throw new ApiError(403, "Only the seller shows the handover code", { code: "SELLER_ONLY" });
    if (!deal.isOpen) throw closedError(deal);
    await assertListingAvailable(deal);

    const handover = newHandover(deal._id);
    const updated = await Deal.findOneAndUpdate(
        { _id: deal._id, seller: me._id, isOpen: true },
        {
            $set: {
                "handover.codeHash": handover.codeHash,
                "handover.tokenHash": handover.tokenHash,
                "handover.expiresAt": handover.expiresAt,
                "handover.attempts": 0
            }
        },
        { returnDocument: "after" }
    ).lean();
    if (!updated) throw await staleDealError(deal._id);

    await broadcast(updated);

    res.set("Cache-Control", "no-store");
    return res.json({
        success: true,
        qr: handover.qr,
        code: handover.code,
        expiresAt: handover.expiresAt,
        deal: await dealDetailFor(updated._id, me._id)
    });
};

// What stops this deal's handover code from being used at all, or null if it could be.
const handoverProblem = (deal, now) => {
    if (!deal) return new ApiError(404, "Deal not found");
    if (!deal.isOpen) return closedError(deal);
    if (!deal.handover?.expiresAt) return new ApiError(400, "The seller hasn't shown a handover code yet", { code: "NO_HANDOVER" });
    if (deal.handover.expiresAt <= now) return new ApiError(400, "This code expired — ask the seller to refresh it", { code: "CODE_EXPIRED" });
    if ((deal.handover.attempts ?? 0) >= MAX_HANDOVER_ATTEMPTS) {
        return new ApiError(429, "Too many wrong tries. Ask the seller to refresh the code", { code: "TOO_MANY_ATTEMPTS" });
    }
    return null;
};

// Why a submitted code didn't complete the deal. A plain wrong code uses up one try, counted on the
// same handover the buyer tried (never on a newer one the seller has just opened).
const handoverError = async (dealId, now, field) => {
    const current = await Deal.findById(dealId).lean();
    const problem = handoverProblem(current, now);
    if (problem) return problem;

    const counted = await Deal.findOneAndUpdate(
        {
            _id: dealId,
            isOpen: true,
            "handover.expiresAt": { $eq: current.handover.expiresAt, $gt: now },
            "handover.attempts": { $lt: MAX_HANDOVER_ATTEMPTS }
        },
        { $inc: { "handover.attempts": 1 } },
        { returnDocument: "after" }
    ).lean();
    if (!counted) {
        return handoverProblem(await Deal.findById(dealId).lean(), now)
            ?? new ApiError(409, "The handover code just changed — try again", { code: "DEAL_CHANGED" });
    }

    const attemptsLeft = MAX_HANDOVER_ATTEMPTS - counted.handover.attempts;
    const message = attemptsLeft > 0
        ? `That code doesn't match. ${attemptsLeft} ${attemptsLeft === 1 ? "try" : "tries"} left.`
        : "That code doesn't match. Ask the seller to refresh the code.";
    return new ApiError(400, message, { code: "WRONG_CODE", attemptsLeft, errors: { [field]: message } });
};

// The buyer confirms the handover by scanning the seller's QR code or typing the 6-digit code.
export const completeDeal = async (req, res) => {
    const me = req.user;
    const { token, code } = req.body;
    const deal = await findDealToAct(req.params.id, me);
    if (!sameId(deal.buyer, me._id)) throw new ApiError(403, "Only the buyer confirms the handover", { code: "BUYER_ONLY" });
    if (!deal.isOpen) throw closedError(deal);
    const listing = await assertListingAvailable(deal);

    const now = new Date();
    const method = token ? "qr" : "code";

    // One conditional update checks everything at once: still open, not expired, tries left and the
    // right code (its hash is part of the filter). A cancel racing it can't also win.
    const completed = await Deal.findOneAndUpdate(
        {
            _id: deal._id,
            buyer: me._id,
            isOpen: true,
            "handover.expiresAt": { $gt: now },
            "handover.attempts": { $lt: MAX_HANDOVER_ATTEMPTS },
            [token ? "handover.tokenHash" : "handover.codeHash"]: handoverHash(deal._id, token ?? code)
        },
        {
            $set: { status: DEAL_STATUS.COMPLETED, isOpen: false, completedAt: now, "handover.method": method, "handover.completedAt": now },
            $unset: { "handover.codeHash": 1, "handover.tokenHash": 1 }
        },
        { returnDocument: "after" }
    ).lean();
    if (!completed) throw await handoverError(deal._id, now, token ? "token" : "code");

    // The listing this deal reserved is sold now (a rental: rented out until its last period ends).
    // Only this deal's own reservation can turn into a sale.
    const sold = await Listing.findOneAndUpdate(
        { _id: completed.listing, reservedFor: completed._id },
        {
            $set: {
                status: LISTING_STATUS.SOLD,
                soldAt: now,
                ...(completed.listingType === "rent" && { rentedUntil: rentedUntil(now, completed.periods ?? 1, listing.rentPeriod) })
            },
            $unset: { reservedFor: 1 }
        },
        { returnDocument: "after" }
    ).lean();
    if (!sold) console.error(`⚠️ Deal ${completed._id} was completed, but its listing wasn't reserved for it`);

    await postDealEvent(completed, "deal_completed", { method }, me._id);
    const link = dealLink(completed._id);
    await notify(completed.seller, {
        type: "deal_completed",
        title: "Deal completed 🎉",
        body: `${firstName(me.name)} confirmed the handover of “${completed.title}”. Leave them a review!`,
        link,
        actor: me._id,
        image: completed.cover
    });
    await notify(me._id, {
        type: "deal_completed",
        title: "Deal completed 🎉",
        body: `The handover of “${completed.title}” is done. How did it go? Leave a review.`,
        link,
        actor: completed.seller,
        image: completed.cover
    });

    await Promise.all([recomputeTrust(completed.buyer), recomputeTrust(completed.seller)]);
    if (sold) await announceListingChange(sold);
    await broadcast(completed);
    if (completed.swapCircle) await checkSwapCircleCompletion(completed.swapCircle);

    return res.json({ success: true, message: "Handover confirmed — deal completed 🎉", deal: await dealDetailFor(completed._id, me._id) });
};

// ── Cancel ────────────────────────────────────────────────

// Either side can cancel an open deal, even while the listing is under review or after a block
// (nobody is stuck in a deal). Between blocked people the note is dropped, so it never reaches the
// other person: not in the chat, the notification or the deal page.
export const cancelDeal = async (req, res) => {
    const me = req.user;
    const { reason } = req.body;
    const deal = await findDealToAct(req.params.id, me);
    if (!deal.isOpen) throw closedError(deal);

    const otherId = counterpartOf(deal, me._id);
    const note = (await isBlockedPair(me._id, otherId)) ? "" : req.body.note;
    const now = new Date();

    const cancelled = await Deal.findOneAndUpdate(
        { _id: deal._id, isOpen: true, ...asParticipant(me._id) },
        {
            $set: { status: DEAL_STATUS.CANCELLED, isOpen: false, cancelledBy: me._id, cancelReason: reason, cancelNote: note, cancelledAt: now },
            $unset: { "handover.codeHash": 1, "handover.tokenHash": 1 }
        },
        { returnDocument: "after" }
    ).lean();
    if (!cancelled) throw await staleDealError(deal._id);

    // Back on sale, but only while this deal still holds the reservation (utils/reservations.js).
    const released = await releaseListing(cancelled.listing, cancelled._id);

    // The offer that became this deal is closed too, and its card in the chat says so.
    if (cancelled.offer) {
        const offer = await Offer.findOneAndUpdate(
            { _id: cancelled.offer, status: OFFER_STATUS.ACCEPTED },
            {
                $set: { status: OFFER_STATUS.CANCELLED, respondedAt: now },
                $push: { history: { by: me._id, action: "cancelled", reason: "deal_cancelled", at: now } }
            },
            { returnDocument: "after" }
        ).lean();
        if (offer) emitToUsers([cancelled.buyer, cancelled.seller], "offer:update", { conversationId: offer.conversation, offer: toOfferShape(offer) });
    }

    await postDealEvent(cancelled, "deal_cancelled", { reason, ...(note && { note }) }, me._id);
    const why = CANCEL_REASON_COPY[reason];
    await notify(otherId, {
        type: "deal_cancelled",
        title: "Deal cancelled",
        body: `${firstName(me.name)} cancelled the deal for “${cancelled.title}”${why ? `: ${why}` : ""}.${note ? ` “${note}”` : ""}`,
        link: dealLink(cancelled._id),
        actor: me._id,
        image: cancelled.cover
    });

    await recomputeTrust(me._id);
    if (released) await announceListingChange(released);
    await broadcast(cancelled);
    if (cancelled.swapCircle) await cancelSwapCircle(cancelled.swapCircle, "deal_cancelled");

    return res.json({ success: true, message: "Deal cancelled", deal: await dealDetailFor(cancelled._id, me._id) });
};

// ── Review ────────────────────────────────────────────────

// Each side reviews a completed deal once.
export const reviewDeal = async (req, res) => {
    const me = req.user;
    const { rating, comment } = req.body;
    const deal = await findDealToAct(req.params.id, me);
    if (deal.status !== DEAL_STATUS.COMPLETED) {
        throw new ApiError(409, "You can leave a review once the handover is done", { code: "DEAL_NOT_COMPLETED" });
    }

    const role = dealRoleOf(deal, me._id);
    const flag = role === "buyer" ? "reviewedByBuyer" : "reviewedBySeller";
    const revieweeId = counterpartOf(deal, me._id);
    const alreadyReviewed = () => new ApiError(409, "You've already reviewed this deal", { code: "ALREADY_REVIEWED" });

    // 1. Claim my one review (two taps at once: only one matches). A completed deal never changes
    //    status again, so a miss means it's reviewed already.
    const claimed = await Deal.findOneAndUpdate(
        { _id: deal._id, status: DEAL_STATUS.COMPLETED, [role]: me._id, [flag]: { $ne: true } },
        { $set: { [flag]: true } },
        { returnDocument: "after" }
    ).lean();
    if (!claimed) throw alreadyReviewed();

    // 2. Save it. The unique { deal, reviewer } index backs up step 1.
    let review;
    try {
        review = await Review.create({ deal: deal._id, listing: deal.listing, reviewer: me._id, reviewee: revieweeId, role, rating, comment });
    } catch (err) {
        if (err.code === 11000) throw alreadyReviewed();
        await Deal.updateOne({ _id: deal._id, [flag]: true }, { $set: { [flag]: false } }); // compensate: let them try again
        throw err;
    }

    await recomputeTrust(revieweeId);
    await notify(revieweeId, {
        type: "review_received",
        title: `${firstName(me.name)} left you a review`,
        body: `${"★".repeat(rating)}${"☆".repeat(5 - rating)} for “${deal.title}”${comment ? `: “${comment}”` : ""}`,
        link: dealLink(deal._id),
        actor: me._id,
        image: deal.cover
    });
    await broadcast(claimed);

    await review.populate(REVIEW_POPULATE);
    return res.status(201).json({
        success: true,
        message: "Thanks for the review!",
        review: toReviewShape(review),
        deal: await dealDetailFor(deal._id, me._id)
    });
};
