import Deal from "../models/deal.model.js";
import Review from "../models/review.model.js";
import { idOf, isPopulated, sameId } from "./ids.js";
import { effectiveStatus, isHidden } from "./listingVisibility.js";
import { toPublicTrust, toPublicUser } from "./publicUser.js";
import { REVIEW_POPULATE, toReviewShape } from "./reviews.js";
import { dealRoleOf } from "./roles.js";
import { emitToUser } from "../socket/index.js";
import { DEAL_STATUS, MAX_HANDOVER_ATTEMPTS, PROFILE_USER_FIELDS, REVIEW_REMINDER_DAYS } from "../config/constants.js";

// Everything toDealCard() reads, for Deal.find(...).populate(DEAL_POPULATE).
export const DEAL_POPULATE = [
    { path: "buyer", select: PROFILE_USER_FIELDS },
    { path: "seller", select: PROFILE_USER_FIELDS },
    { path: "listing", select: "status moderation deletedAt expiresAt" }
];

const REVIEW_REMINDER_MS = REVIEW_REMINDER_DAYS * 24 * 60 * 60 * 1000;

// What the viewer has to do next. Deal cards and the Deals badge (countDealsNeedingAction) both ask
// this one function, so they can never disagree.
// needsAction: the deal is open and the next step is mine. Nobody has proposed a meetup yet, the other
//              person proposed one I haven't confirmed, or it's scheduled and I'm the seller (starting
//              the handover is my move).
// needsReview: it was completed in the last 30 days and I haven't reviewed it (old deals stop nagging).
export const dealAttention = (deal, userId, now = new Date()) => {
    const role = dealRoleOf(deal, userId);
    if (!role) return { needsAction: false, needsReview: false };

    const meetup = deal.meetup ?? {};
    const needsAction = Boolean(deal.isOpen) && (
        !meetup.at ||
        (!meetup.confirmed && !sameId(meetup.proposedBy, userId)) ||
        (deal.status === DEAL_STATUS.SCHEDULED && role === "seller")
    );

    const reviewed = role === "buyer" ? deal.reviewedByBuyer : deal.reviewedBySeller;
    const needsReview = deal.status === DEAL_STATUS.COMPLETED && !reviewed && now - deal.completedAt < REVIEW_REMINDER_MS;

    return { needsAction, needsReview };
};

// The Deals badge: my deals waiting for my next step or my review. Only open and recently completed
// deals can count, so only those are loaded (a handful per student).
export const countDealsNeedingAction = async (userId, now = new Date()) => {
    const deals = await Deal.find({
        $and: [
            { $or: [{ buyer: userId }, { seller: userId }] },
            { $or: [{ isOpen: true }, { status: DEAL_STATUS.COMPLETED, completedAt: { $gt: new Date(now.getTime() - REVIEW_REMINDER_MS) } }] }
        ]
    })
        .select("status isOpen buyer seller meetup completedAt reviewedByBuyer reviewedBySeller")
        .lean();

    return deals.filter((deal) => {
        const { needsAction, needsReview } = dealAttention(deal, userId, now);
        return needsAction || needsReview;
    }).length;
};

// A handover code works while the deal is open, the code hasn't expired and wrong tries are left.
const isHandoverActive = (deal, now) =>
    Boolean(deal.isOpen && deal.handover?.expiresAt > now && (deal.handover.attempts ?? 0) < MAX_HANDOVER_ATTEMPTS);

// A deal as one participant sees it. Every response and socket event uses this, so the handover
// hashes can never slip out.
export const toDealCard = (deal, viewerId, now = new Date()) => {
    const role = dealRoleOf(deal, viewerId) ?? "viewer"; // "viewer": a campus admin looking at someone else's deal
    const other = role === "seller" ? deal.buyer : deal.seller;
    const listing = isPopulated(deal.listing) ? deal.listing : null;
    const { meetup } = deal;

    return {
        _id: deal._id,
        status: deal.status,
        role,
        amount: deal.amount,
        periods: deal.periods ?? 1,
        listingType: deal.listingType,
        title: deal.title,
        cover: deal.cover ?? "",
        listing: {
            _id: listing?._id ?? idOf(deal.listing) ?? null,
            status: listing ? effectiveStatus(listing) : null,
            hidden: !listing || isHidden(listing)
        },
        otherUser: isPopulated(other) ? { ...toPublicUser(other), trust: toPublicTrust(other.trust) } : null,
        meetup: meetup?.at
            ? {
                spotId: idOf(meetup.spotId) ?? null,
                spotName: meetup.spotName ?? "",
                at: meetup.at,
                proposedBy: idOf(meetup.proposedBy) ?? null,
                confirmed: Boolean(meetup.confirmed)
            }
            : null,
        // Lets the buyer's screen follow the seller's QR code live (deal:update carries this card).
        handover: { active: isHandoverActive(deal, now), expiresAt: deal.handover?.expiresAt ?? null },
        createdAt: deal.createdAt,
        updatedAt: deal.updatedAt,
        completedAt: deal.completedAt ?? null,
        ...dealAttention(deal, viewerId, now),
        swapCircle: deal.swapCircle ? idOf(deal.swapCircle) : null
    };
};

// The deal page: the card plus what only the detail view needs. `reviews` are this deal's reviews,
// populated with REVIEW_POPULATE ("mine" and "theirs" are only filled in for the two participants).
export const toDealDetail = (deal, viewerId, reviews = [], now = new Date()) => {
    const card = toDealCard(deal, viewerId, now);
    const isParticipant = card.role !== "viewer";
    const mine = isParticipant ? reviews.find((review) => sameId(review.reviewer, viewerId)) : null;
    const theirs = isParticipant ? reviews.find((review) => !sameId(review.reviewer, viewerId)) : null;

    return {
        ...card,
        conversationId: deal.conversation ? idOf(deal.conversation) : null,
        cancelReason: deal.cancelReason ?? null,
        cancelNote: deal.cancelNote ?? "",
        cancelledBy: deal.cancelledBy ? idOf(deal.cancelledBy) : null,
        cancelledAt: deal.cancelledAt ?? null,
        reviews: {
            mine: mine ? toReviewShape(mine) : null,
            theirs: theirs ? toReviewShape(theirs) : null
        }
    };
};

// Loads everything the deal page shows and builds it for `viewerId` (null if the deal is gone).
export const dealDetailFor = async (dealId, viewerId) => {
    const [deal, reviews] = await Promise.all([
        Deal.findById(dealId).populate(DEAL_POPULATE).lean(),
        Review.find({ deal: dealId }).populate(REVIEW_POPULATE).lean()
    ]);
    return deal ? toDealDetail(deal, viewerId, reviews) : null;
};

// deal:update { dealId, deal } to both participants, each with their own card. `deal` is populated
// with DEAL_POPULATE (for callers that already loaded it).
export const emitDealCards = (deal, now = new Date()) => {
    for (const userId of [idOf(deal.buyer), idOf(deal.seller)]) {
        emitToUser(userId, "deal:update", { dealId: deal._id, deal: toDealCard(deal, userId, now) });
    }
};

// Loads the deal and sends deal:update. Never throws: the change itself is already saved.
export const emitDealUpdate = async (dealId) => {
    try {
        const deal = await Deal.findById(dealId).populate(DEAL_POPULATE).lean();
        if (deal) emitDealCards(deal);
    } catch (err) {
        console.error("⚠️ Couldn't send deal:update:", err.message);
    }
};
