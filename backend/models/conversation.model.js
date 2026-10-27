import mongoose from "mongoose";
import { LISTING_TYPES, MESSAGE_TYPES } from "../config/constants.js";

const { ObjectId } = mongoose.Schema.Types;

// One chat per (listing, visitor): the visitor is whoever messaged the listing's owner.
const conversationSchema = new mongoose.Schema(
    {
        listing: {
            type: ObjectId,
            ref: "Listing",
            required: true
        },

        // Posted the listing.
        owner: {
            type: ObjectId,
            ref: "User",
            required: true
        },

        // Started the chat.
        visitor: {
            type: ObjectId,
            ref: "User",
            required: true
        },

        // Decided once, when the chat starts (utils/roles.js), so editing the listing later
        // can never swap who pays and who hands the item over.
        buyer: {
            type: ObjectId,
            ref: "User",
            required: true
        },

        seller: {
            type: ObjectId,
            ref: "User",
            required: true
        },

        // [owner, visitor]: lets "my chats" be one indexed query.
        participants: [
            {
                type: ObjectId,
                ref: "User"
            }
        ],

        // Enough to keep showing the chat after the listing is deleted.
        // (`type: { type: String }` because a plain `type: String` would make Mongoose treat the whole object as a string.)
        listingSnapshot: {
            title: String,
            cover: String,
            type: { type: String, enum: LISTING_TYPES }
        },

        // Inbox preview of the newest message (text cut to 140 characters).
        lastMessage: {
            text: String,
            type: { type: String, enum: MESSAGE_TYPES },
            sender: { type: ObjectId, ref: "User" },
            createdAt: Date
        },

        // Starts at creation time so new chats sort sensibly before their first message.
        lastMessageAt: {
            type: Date,
            default: Date.now
        },

        // A message is "Seen" once the other person's lastReadAt is at or after its createdAt.
        lastReadAt: {
            owner: Date,
            visitor: Date
        },

        unread: {
            owner: { type: Number, default: 0 },
            visitor: { type: Number, default: 0 }
        },

        // The offer currently waiting for a reply (at most one per chat).
        activeOffer: {
            type: ObjectId,
            ref: "Offer",
            default: null
        },

        // The latest deal agreed in this chat.
        deal: {
            type: ObjectId,
            ref: "Deal",
            default: null
        }
    },
    { timestamps: true }
);

// Makes "find or create" safe: two clicks on "Message seller" can never open two chats.
// It also serves "every chat about this listing" queries.
conversationSchema.index({ listing: 1, visitor: 1 }, { unique: true });
conversationSchema.index({ participants: 1, lastMessageAt: -1 });

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
