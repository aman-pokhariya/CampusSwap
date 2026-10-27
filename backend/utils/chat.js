import mongoose from "mongoose";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import ApiError from "./ApiError.js";
import { inBatches } from "./batch.js";
import { bumpStat } from "./stats.js";
import { countDealsNeedingAction } from "./deals.js";
import { idOf, sameId } from "./ids.js";
import { effectiveStatus, isHidden } from "./listingVisibility.js";
import { CONVERSATION_POPULATE, toConversationShape, toMessageShape } from "./chatShapes.js";
import { emitToUser, emitToUsers, isOnline } from "../socket/index.js";

const SIDES = ["owner", "visitor"];
const PREVIEW_LENGTH = 140;

const SYSTEM_PREVIEWS = {
    offer_countered: "Counter offer",
    offer_accepted: "Offer accepted — deal created",
    offer_declined: "Offer declined",
    offer_withdrawn: "Offer withdrawn",
    offer_cancelled: "Offer cancelled",
    offer_expired: "Offer expired",
    deal_meetup_proposed: "Meetup proposed",
    deal_meetup_confirmed: "Meetup confirmed",
    deal_completed: "Deal completed",
    deal_cancelled: "Deal cancelled",
    listing_sold: "Listing marked as sold",
    listing_deleted: "Listing deleted"
};

// The inbox line for a message.
const previewOf = (message) => {
    if (message.type === "image") return message.text ? `📷 ${message.text}` : "📷 Photo";
    if (message.type === "offer") return "💰 New offer";
    if (message.type === "system") return SYSTEM_PREVIEWS[message.system?.event] ?? "Update";
    return message.text;
};

// Loads a conversation the user takes part in. Anyone else gets a 404, so ids can't be probed.
export const findConversationFor = async (id, user) => {
    if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Conversation not found");

    const conversation = await Conversation.findOne({ _id: id, participants: user._id }).lean();
    if (!conversation) throw new ApiError(404, "Conversation not found");
    return conversation;
};

// Populates a lean conversation and builds what `viewerId` sees.
export const conversationShapeFor = async (conversation, viewerId) =>
    toConversationShape(await Conversation.populate(conversation, CONVERSATION_POPULATE), viewerId);

// Total unread messages across the user's chats (the Chats badge).
export const countUnreadChats = async (userId) => {
    const me = new mongoose.Types.ObjectId(idOf(userId));
    const [result] = await Conversation.aggregate([
        { $match: { participants: me } },
        { $group: { _id: null, total: { $sum: { $cond: [{ $eq: ["$owner", me] }, "$unread.owner", "$unread.visitor"] } } } }
    ]);
    return result?.total ?? 0;
};

export const unreadCounts = async (userId) => {
    const [chats, deals] = await Promise.all([countUnreadChats(userId), countDealsNeedingAction(userId)]);
    return { chats, deals };
};

// unread:update { chats, deals } to every open tab of the user. Never throws (the change is saved already).
export const emitUnread = async (userId) => {
    if (!isOnline(idOf(userId))) return;
    try {
        emitToUser(userId, "unread:update", await unreadCounts(userId));
    } catch (err) {
        console.error("⚠️ Couldn't send unread:update:", err.message);
    }
};

// Only someone in this chat can be its actor (never, say, the buyer who got the item in another chat).
const actorIn = (conversation, userId) => (conversation.participants.some((id) => sameId(id, userId)) ? userId : null);

// Saves a message and, in one atomic update, moves the chat's preview forward and adds one to the
// unread counter of everyone except `actorId` (the sender, or whoever caused a system message;
// leave it out for background jobs and both people get a bump). Then tells both screens.
// `unreadFor` narrows who may get a bump at all (e.g. only the "visitor"); the actor never does.
// `set` adds fields to the same update (e.g. the chat's new activeOffer).
// Each unread counter always equals the messages newer than that person's lastReadAt, the same
// rule "Seen" uses: a message a "mark read" already covered (it can finish first) isn't counted.
export const postMessage = async (conversation, fields, { actorId = null, clientId, set = {}, unreadFor = SIDES } = {}) => {
    const actor = actorIn(conversation, actorId);
    const message = await Message.create({
        conversation: conversation._id,
        ...fields,
        ...(fields.type === "system" && { system: { ...fields.system, actor } })
    });
    if (message.offer) await message.populate("offer");

    const recipients = SIDES.filter((side) => unreadFor.includes(side) && !sameId(conversation[side], actor));
    const preview = {
        text: previewOf(message).slice(0, PREVIEW_LENGTH),
        type: message.type,
        sender: message.sender,
        createdAt: message.createdAt
    };

    let before;
    try {
        // A pipeline update, so the preview only moves forward in time: two messages saved at the
        // same moment can finish in either order, and the older one must not overwrite the newer.
        before = await Conversation.findOneAndUpdate(
            { _id: conversation._id },
            [
                {
                    $set: {
                        ...set,
                        lastMessage: {
                            $cond: [
                                { $gte: [message.createdAt, { $ifNull: ["$lastMessageAt", new Date(0)] }] },
                                { $literal: preview },
                                "$lastMessage"
                            ]
                        },
                        lastMessageAt: { $max: ["$lastMessageAt", message.createdAt] },
                        ...Object.fromEntries(
                            recipients.map((side) => [
                                `unread.${side}`,
                                {
                                    $cond: [
                                        { $gt: [message.createdAt, { $ifNull: [`$lastReadAt.${side}`, new Date(0)] }] },
                                        { $add: [{ $ifNull: [`$unread.${side}`, 0] }, 1] },
                                        { $ifNull: [`$unread.${side}`, 0] }
                                    ]
                                }
                            ])
                        )
                    }
                }
            ],
            { returnDocument: "before", updatePipeline: true }
        ).lean();
    } catch (err) {
        await Message.deleteOne({ _id: message._id }); // compensate: no message without its preview and unread bump
        throw err;
    }

    if (!before?.lastMessage?.createdAt && message.type !== "system") await bumpStat(conversation.listing, "chats");

    const isNewest = !before?.lastMessageAt || message.createdAt >= before.lastMessageAt;
    const latest = isNewest
        ? { lastMessage: preview, lastMessageAt: message.createdAt }
        : { lastMessage: before.lastMessage, lastMessageAt: before.lastMessageAt };

    emitToUsers(conversation.participants, "message:new", {
        conversationId: conversation._id,
        message: toMessageShape(message),
        conversation: { _id: conversation._id, ...latest },
        ...(clientId && { clientId })
    });
    await Promise.all(recipients.map((side) => emitUnread(conversation[side])));

    return message;
};

// Tells everyone chatting about a listing that it changed (status banner, composer). With an `event`
// (listing_sold, listing_deleted) the change is also posted in every chat that already has messages.
export const announceListingChange = async (listing, { event, actorId = null } = {}) => {
    const conversations = await Conversation.find({ listing: listing._id })
        .select("listing owner visitor participants lastMessage lastMessageAt")
        .lean();
    if (conversations.length === 0) return;

    emitToUsers(conversations.flatMap((conversation) => conversation.participants), "listing:update", {
        listingId: listing._id,
        status: effectiveStatus(listing),
        deleted: Boolean(listing.deletedAt),
        hidden: isHidden(listing)
    });

    if (!event) return;
    // One message per chat, side by side (each chat is its own document).
    await inBatches(conversations.filter((c) => c.lastMessage?.createdAt), (conversation) =>
        postMessage(conversation, { type: "system", system: { event, data: { listingId: listing._id } } }, { actorId })
    );
};
