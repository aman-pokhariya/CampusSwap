import mongoose from "mongoose";
import { DEAL_ROLES, OFFER_STATUS } from "../config/constants.js";

const { ObjectId } = mongoose.Schema.Types;

// One step in the negotiation, shown in the offer card's history.
const historySchema = new mongoose.Schema(
    {
        // null when the system did it (expiry, or the listing stopped being available).
        by: {
            type: ObjectId,
            ref: "User",
            default: null
        },
        action: {
            type: String,
            enum: ["offered", "countered", "accepted", "declined", "withdrawn", "cancelled", "expired"],
            required: true
        },
        amount: Number,
        periods: Number,
        note: String,
        // Why it was cancelled: "reserved", "sold", "deleted", "unavailable", ...
        reason: String,
        at: {
            type: Date,
            default: Date.now
        }
    },
    { _id: false }
);

const offerSchema = new mongoose.Schema(
    {
        listing: {
            type: ObjectId,
            ref: "Listing",
            required: true
        },

        conversation: {
            type: ObjectId,
            ref: "Conversation",
            required: true
        },

        // Copied from the conversation, never recomputed from the listing.
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

        // Whole rupees. Rent: per rental period (the deal is amount × periods). Free: always 0.
        amount: {
            type: Number,
            required: true,
            min: 0,
            validate: { validator: Number.isInteger, message: "Use whole rupees" }
        },

        // Rent only: how many days/weeks/months.
        periods: {
            type: Number,
            min: 1,
            max: 52,
            default: 1
        },

        // Swap: what they're offering in exchange. Otherwise an optional message.
        note: {
            type: String,
            trim: true,
            maxlength: 300,
            default: ""
        },

        status: {
            type: String,
            enum: Object.values(OFFER_STATUS),
            default: OFFER_STATUS.PENDING
        },

        // Whose turn it is to reply. Flips on every counter.
        awaiting: {
            type: String,
            enum: DEAL_ROLES,
            required: true
        },

        // Who made the latest proposal (only they can withdraw it).
        proposedBy: {
            type: ObjectId,
            ref: "User",
            required: true
        },

        history: [historySchema],

        // Reset by every counter. Past it, the offer counts as expired even before a job marks it.
        expiresAt: {
            type: Date,
            required: true
        },

        respondedAt: Date,

        // Set when accepted: the deal this offer became.
        deal: {
            type: ObjectId,
            ref: "Deal"
        }
    },
    { timestamps: true }
);

// At most one pending offer per chat. A partial unique index enforces it even when two
// people press "Make offer" at the same moment.
offerSchema.index({ conversation: 1 }, { unique: true, partialFilterExpression: { status: OFFER_STATUS.PENDING } });
offerSchema.index({ conversation: 1, createdAt: -1 });
offerSchema.index({ listing: 1, status: 1 });
offerSchema.index({ status: 1, expiresAt: 1 });

const Offer = mongoose.model("Offer", offerSchema);

export default Offer;
