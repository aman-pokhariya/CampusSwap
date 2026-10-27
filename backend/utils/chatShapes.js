import { isBlockedPair } from "./blocks.js";
import { idOf, isPopulated } from "./ids.js";
import { effectiveStatus, isHidden } from "./listingVisibility.js";
import { toPublicUser } from "./publicUser.js";
import { chatRoleOf, dealRoleOf, otherChatRole } from "./roles.js";
import { MODERATION_STATE, OFFER_STATUS, PROFILE_USER_FIELDS } from "../config/constants.js";

// One builder per thing the chat screens show, so HTTP responses and socket events always match.

// Lazy expiry: a pending offer past its expiry date is shown (and treated) as expired,
// even before anything has marked it in the database.
export const isOfferExpired = (offer, now = new Date()) => offer.status === OFFER_STATUS.PENDING && offer.expiresAt <= now;

export const isOfferLive = (offer, now = new Date()) => offer.status === OFFER_STATUS.PENDING && offer.expiresAt > now;

export const toOfferShape = (offer) => ({
    _id: offer._id,
    listing: idOf(offer.listing),
    conversation: idOf(offer.conversation),
    buyer: idOf(offer.buyer),
    seller: idOf(offer.seller),
    amount: offer.amount,
    periods: offer.periods ?? 1,
    // What the deal would be worth: rent offers are per period.
    total: offer.amount * (offer.periods ?? 1),
    note: offer.note ?? "",
    status: isOfferExpired(offer) ? OFFER_STATUS.EXPIRED : offer.status,
    awaiting: offer.awaiting,
    proposedBy: idOf(offer.proposedBy),
    history: offer.history ?? [],
    expiresAt: offer.expiresAt,
    respondedAt: offer.respondedAt ?? null,
    deal: offer.deal ? idOf(offer.deal) : null,
    createdAt: offer.createdAt,
    updatedAt: offer.updatedAt
});

// `message.offer` is populated for offer messages, so the card always shows the offer's latest state.
export const toMessageShape = (message) => ({
    _id: message._id,
    conversation: idOf(message.conversation),
    sender: message.sender ? idOf(message.sender) : null,
    type: message.type,
    text: message.text ?? "",
    image: message.image?.url ? { url: message.image.url } : null,
    offer: isPopulated(message.offer) ? toOfferShape(message.offer) : null,
    system: message.system?.event
        ? { event: message.system.event, data: message.system.data ?? {}, actor: message.system.actor ? idOf(message.system.actor) : null }
        : null,
    createdAt: message.createdAt
});

// Everything toConversationShape() reads, for Conversation.find(...).populate(CONVERSATION_POPULATE).
export const CONVERSATION_POPULATE = [
    { path: "listing", select: "title type price rentPeriod status images moderation deletedAt expiresAt" },
    { path: "owner", select: PROFILE_USER_FIELDS },
    { path: "visitor", select: PROFILE_USER_FIELDS },
    { path: "activeOffer" },
    { path: "deal", select: "status" }
];

// A conversation as one participant sees it. The listing part falls back to the snapshot taken when
// the chat started, so it still renders after the listing is deleted. Lists pass `blockedIds` (a Set of
// id strings from blockedIdsFor) so each chat doesn't need its own block lookup.
export const toConversationShape = async (conversation, viewerId, { blockedIds } = {}) => {
    const role = chatRoleOf(conversation, viewerId);
    const other = conversation[otherChatRole(role)];
    const listing = isPopulated(conversation.listing) ? conversation.listing : null;
    const snapshot = conversation.listingSnapshot ?? {};
    const blocked = blockedIds ? blockedIds.has(idOf(other)) : await isBlockedPair(viewerId, idOf(other));
    const offer = conversation.activeOffer;
    const activeOffer = isPopulated(offer) && isOfferLive(offer) ? toOfferShape(offer) : null;

    return {
        _id: conversation._id,
        role,
        myDealRole: dealRoleOf(conversation, viewerId),
        listing: {
            _id: listing?._id ?? null,
            title: listing?.title ?? snapshot.title ?? "",
            type: listing?.type ?? snapshot.type ?? null,
            price: listing?.price ?? null,
            rentPeriod: listing?.rentPeriod ?? null,
            status: listing ? effectiveStatus(listing) : null,
            cover: listing?.images?.[0]?.url ?? snapshot.cover ?? "",
            deleted: !listing || Boolean(listing.deletedAt),
            // Hidden = under review, removed or deleted (the listing page is a 404 for the visitor).
            hidden: !listing || isHidden(listing),
            removed: listing?.moderation?.state === MODERATION_STATE.REMOVED
        },
        otherUser: {
            ...toPublicUser(isPopulated(other) ? other : { _id: idOf(other), name: "CampusSwap member" }),
            // Last seen is only for people on the same campus who haven't blocked each other.
            lastSeenAt: blocked ? null : other?.lastSeenAt ?? null
        },
        lastMessage: conversation.lastMessage?.createdAt ? conversation.lastMessage : null,
        lastMessageAt: conversation.lastMessageAt,
        unreadCount: conversation.unread?.[role] ?? 0,
        otherLastReadAt: conversation.lastReadAt?.[otherChatRole(role)] ?? null,
        activeOffer,
        deal: isPopulated(conversation.deal) ? { _id: conversation.deal._id, status: conversation.deal.status } : null,
        blocked
    };
};
