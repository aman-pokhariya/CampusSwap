import mongoose from "mongoose";
import { MAX_MESSAGE_LENGTH, MESSAGE_TYPES, SYSTEM_EVENTS } from "../config/constants.js";

const { ObjectId } = mongoose.Schema.Types;

const messageSchema = new mongoose.Schema(
    {
        conversation: {
            type: ObjectId,
            ref: "Conversation",
            required: true
        },

        // null for system messages ("Offer accepted", "Listing sold").
        sender: {
            type: ObjectId,
            ref: "User",
            default: null
        },

        type: {
            type: String,
            enum: MESSAGE_TYPES,
            required: true
        },

        // The message itself, or an optional caption for a photo.
        text: {
            type: String,
            trim: true,
            maxlength: MAX_MESSAGE_LENGTH,
            default: ""
        },

        image: {
            url: String,
            publicId: String
        },

        // type "offer": the offer card shown in the chat (always populated with its latest state).
        offer: {
            type: ObjectId,
            ref: "Offer"
        },

        system: {
            event: {
                type: String,
                enum: SYSTEM_EVENTS
            },
            data: mongoose.Schema.Types.Mixed,
            // Whose action caused it (unset for background jobs). Their own unread counter is never bumped.
            actor: {
                type: ObjectId,
                ref: "User"
            }
        }
    },
    { timestamps: true }
);

// Newest-first pages of one chat; _id breaks ties between messages saved in the same millisecond.
messageSchema.index({ conversation: 1, createdAt: -1, _id: -1 });

const Message = mongoose.model("Message", messageSchema);

export default Message;
