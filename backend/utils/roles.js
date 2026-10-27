import { sameId } from "./ids.js";

// "wanted" posts are written by the buyer; every other type by the seller.
// Called once, when a conversation starts. Offers and deals copy the result instead of recomputing it.
export const dealRoles = (listingType, ownerId, visitorId) =>
    listingType === "wanted" ? { buyer: ownerId, seller: visitorId } : { buyer: visitorId, seller: ownerId };

// The viewer's side of a conversation: "owner" (posted the listing) or "visitor" (started the chat).
export const chatRoleOf = (conversation, userId) => {
    if (sameId(conversation.owner, userId)) return "owner";
    if (sameId(conversation.visitor, userId)) return "visitor";
    return null;
};

export const otherChatRole = (role) => (role === "owner" ? "visitor" : "owner");

// "buyer" or "seller" in anything that stores both (conversation, offer, deal).
export const dealRoleOf = (record, userId) => {
    if (sameId(record.buyer, userId)) return "buyer";
    if (sameId(record.seller, userId)) return "seller";
    return null;
};

export const otherDealRole = (role) => (role === "buyer" ? "seller" : "buyer");

// The other person in a conversation, offer or deal (all three store buyer and seller).
export const counterpartOf = (record, userId) => (sameId(record.buyer, userId) ? record.seller : record.buyer);
