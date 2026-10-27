import Conversation from "../models/conversation.model.js";
import Listing from "../models/listing.model.js";
import Message from "../models/message.model.js";
import ApiError from "../utils/ApiError.js";
import { blockedIdsFor, isBlockedPair } from "../utils/blocks.js";
import { findPageBefore } from "../utils/paginate.js";
import { claimListingTerms } from "../utils/listingTerms.js";
import { deleteImage, uploadImage } from "../utils/storage.js";
import { isDiscoverable, isHidden } from "../utils/listingVisibility.js";
import { chatRoleOf, counterpartOf, dealRoles, otherChatRole } from "../utils/roles.js";
import { CONVERSATION_POPULATE, toConversationShape, toMessageShape } from "../utils/chatShapes.js";
import {
    conversationShapeFor,
    countUnreadChats,
    emitUnread,
    findConversationFor,
    postMessage,
    unreadCounts
} from "../utils/chat.js";
import { emitToUsers } from "../socket/index.js";
import { MODERATION_STATE } from "../config/constants.js";

// ── Start / list ──────────────────────────────────────────

const unavailableError = () => new ApiError(400, "This item is no longer available", { code: "LISTING_UNAVAILABLE" });

// Two clicks on "Message seller" at once: the unique { listing, visitor } index lets only one
// insert through, and the other request picks up that conversation.
const findOrCreateConversation = async (listing, visitorId) => {
    const filter = { listing: listing._id, visitor: visitorId };
    const existing = await Conversation.findOne(filter).lean();
    if (existing) return { conversation: existing, created: false };

    if (!isDiscoverable(listing)) throw unavailableError();
    // The chat's buyer and seller come from listing.type below, so it only starts while that is still
    // the listing's type: an edit changing it at this moment makes one of the two fail.
    await claimListingTerms(listing, unavailableError);

    let conversation;
    try {
        conversation = await Conversation.create({
            ...filter,
            owner: listing.seller,
            ...dealRoles(listing.type, listing.seller, visitorId),
            participants: [listing.seller, visitorId],
            listingSnapshot: { title: listing.title, cover: listing.images[0]?.url ?? "", type: listing.type }
        });
    } catch (err) {
        if (err.code !== 11000) throw err;
        return { conversation: await Conversation.findOne(filter).lean(), created: false };
    }

    // The owner may have deleted the listing meanwhile. deleteListing marks it deleted before it looks
    // for chats and this checks after creating one, so one of the two always sees the other: no chat is
    // left pointing at a listing (and photos) deleted for good.
    if (!(await Listing.exists({ _id: listing._id, deletedAt: null }))) {
        await Conversation.deleteOne({ _id: conversation._id }); // compensate: it's brand new and empty
        throw unavailableError();
    }
    return { conversation: conversation.toObject(), created: true };
};

// "Message seller" (or "Message buyer" on a wanted post). The caller is always the visitor.
// Starting a chat doesn't count towards the listing's stats; its first message does.
export const startConversation = async (req, res) => {
    const me = req.user;
    const listing = await Listing.findById(req.body.listingId).lean();

    // Chats never cross campuses (not even for admins), and hidden listings can't be found.
    if (!listing || !listing.campus.equals(me.campus) || isHidden(listing)) {
        throw new ApiError(404, "Listing not found");
    }
    if (listing.seller.equals(me._id)) {
        throw new ApiError(400, "This is your own listing", { code: "OWN_LISTING" });
    }
    if (await isBlockedPair(me._id, listing.seller)) {
        throw new ApiError(403, "You can't message this person", { code: "BLOCKED" });
    }

    const { conversation, created } = await findOrCreateConversation(listing, me._id);
    return res.status(created ? 201 : 200).json({ success: true, conversation: await conversationShapeFor(conversation, me._id) });
};

export const getConversations = async (req, res) => {
    const { before, limit, listing } = req.validatedQuery;
    const me = req.user._id;

    // An owner only sees chats once there's a message in them; the visitor sees the chat they opened.
    const filter = {
        participants: me,
        $or: [{ "lastMessage.createdAt": { $ne: null } }, { visitor: me }],
        ...(listing && { listing })
    };

    const [{ rows, hasMore }, unreadTotal, blockedIds] = await Promise.all([
        findPageBefore(Conversation, filter, { field: "lastMessageAt", before, limit }),
        countUnreadChats(me),
        blockedIdsFor(me)
    ]);
    await Conversation.populate(rows, CONVERSATION_POPULATE);
    const blocked = new Set(blockedIds.map(String));
    const conversations = await Promise.all(rows.map((conversation) => toConversationShape(conversation, me, { blockedIds: blocked })));

    return res.json({ success: true, conversations, hasMore, unreadTotal });
};

// The Chats and Deals badges.
export const getUnreadCount = async (req, res) => {
    return res.json({ success: true, ...(await unreadCounts(req.user._id)) });
};

export const getConversation = async (req, res) => {
    const conversation = await findConversationFor(req.params.id, req.user);
    return res.json({ success: true, conversation: await conversationShapeFor(conversation, req.user._id) });
};

// ── Messages ──────────────────────────────────────────────

export const getMessages = async (req, res) => {
    const conversation = await findConversationFor(req.params.id, req.user);
    const { before, limit } = req.validatedQuery;

    const { rows, hasMore } = await findPageBefore(Message, { conversation: conversation._id }, { field: "createdAt", before, limit });
    await Message.populate(rows, { path: "offer" });
    const otherRole = otherChatRole(chatRoleOf(conversation, req.user._id));

    return res.json({
        success: true,
        // Oldest first within a page: the order a chat is read in.
        messages: rows.reverse().map(toMessageShape),
        hasMore,
        otherLastReadAt: conversation.lastReadAt?.[otherRole] ?? null
    });
};

// A chat closes when either person has blocked the other, or the listing was deleted or removed.
const assertChatOpen = async (conversation, userId) => {
    if (await isBlockedPair(userId, counterpartOf(conversation, userId))) {
        throw new ApiError(403, "You can't message this person", { code: "BLOCKED" });
    }

    const listing = await Listing.findById(conversation.listing).select("deletedAt moderation").lean();
    if (!listing || listing.deletedAt) {
        throw new ApiError(409, "This listing was deleted, so the chat is closed", { code: "CHAT_CLOSED" });
    }
    // Kept vague on purpose: moderation decisions are only shared with the listing's owner.
    if (listing.moderation?.state === MODERATION_STATE.REMOVED) {
        throw new ApiError(409, "This listing isn't available any more, so the chat is closed", { code: "CHAT_CLOSED" });
    }
};

// JSON { text, clientId? } or multipart (image + optional text and clientId). The clientId is the
// browser's temporary id for its optimistic bubble; it comes back in the response and in message:new.
export const sendMessage = async (req, res) => {
    const conversation = await findConversationFor(req.params.id, req.user);
    const { text, clientId } = req.body;

    if (!text && !req.file) throw new ApiError(400, "Write a message", { errors: { text: "Write a message" } });
    await assertChatOpen(conversation, req.user._id);

    // Cloudinary re-encodes chat photos (the "chats" transform), which also strips EXIF/GPS data.
    const image = req.file ? await uploadImage(req.file, "chats") : undefined;

    let message;
    try {
        message = await postMessage(
            conversation,
            { sender: req.user._id, type: image ? "image" : "text", text, image },
            { actorId: req.user._id, clientId }
        );
    } catch (err) {
        if (image) await deleteImage(image.publicId); // don't leave an orphaned photo behind
        throw err;
    }

    return res.status(201).json({ success: true, message: toMessageShape(message), clientId: clientId || null });
};

// Marks everything up to the newest message as read. Read receipts ("Seen") come from lastReadAt, and
// the unread counter always equals the messages after it (see postMessage).
export const markRead = async (req, res) => {
    const conversation = await findConversationFor(req.params.id, req.user);
    const me = req.user._id;
    const role = chatRoleOf(conversation, me);
    const previous = conversation.lastReadAt?.[role];

    // Already up to date: nothing to save or announce (the chat screen calls this often).
    if (!conversation.unread?.[role] && previous >= conversation.lastMessageAt) return res.json({ success: true, readAt: previous });

    // One pipeline update reads lastMessageAt as it is right now: every message counted so far is at or
    // before it, so the counter can go to 0, and postMessage only counts a message still being saved if
    // it's newer. $max: two tabs reading at once can never move lastReadAt backwards.
    const updated = await Conversation.findOneAndUpdate(
        { _id: conversation._id },
        [{ $set: { [`lastReadAt.${role}`]: { $max: [`$lastReadAt.${role}`, "$lastMessageAt"] }, [`unread.${role}`]: 0 } }],
        { returnDocument: "after", updatePipeline: true }
    ).lean();
    if (!updated) throw new ApiError(404, "Conversation not found");
    const readAt = updated.lastReadAt[role];

    // To both people: the other sees "Seen", and my other tabs clear this chat's badge.
    emitToUsers(conversation.participants, "conversation:read", { conversationId: conversation._id, userId: me, readAt });
    await emitUnread(me);

    return res.json({ success: true, readAt });
};
