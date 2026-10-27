import mongoose from "mongoose";
import { CANCEL_REASONS, DEAL_STATUS, LISTING_TYPES } from "../config/constants.js";

const { ObjectId } = mongoose.Schema.Types;

// Created when an offer is accepted. Title, cover, amount and hostels are copied in, so the deal
// still reads correctly after the listing is edited or deleted.
const dealSchema = new mongoose.Schema(
    {
        listing: {
            type: ObjectId,
            ref: "Listing",
            required: true
        },

        conversation: {
            type: ObjectId,
            ref: "Conversation"
        },

        // The accepted offer (swap circle deals have none).
        offer: {
            type: ObjectId,
            ref: "Offer"
        },

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

        campus: {
            type: ObjectId,
            ref: "Campus",
            required: true
        },

        swapCircle: {
            type: ObjectId,
            ref: "SwapCircle"
        },

        // The total in whole rupees (rent: per-period amount × periods).
        amount: {
            type: Number,
            min: 0,
            default: 0
        },

        periods: {
            type: Number,
            min: 1,
            default: 1
        },

        listingType: {
            type: String,
            enum: LISTING_TYPES,
            required: true
        },

        category: String,
        title: String,
        cover: String,
        sellerHostel: String,
        buyerHostel: String,

        status: {
            type: String,
            enum: Object.values(DEAL_STATUS),
            default: DEAL_STATUS.AGREED
        },

        // true while agreed or scheduled. A partial unique index on it allows one open deal per listing.
        isOpen: {
            type: Boolean,
            default: true
        },

        // spotId is one of the campus's safeSpots; its name is copied in case the spot is renamed later.
        meetup: {
            spotId: ObjectId,
            spotName: String,
            at: Date,
            proposedBy: {
                type: ObjectId,
                ref: "User"
            },
            confirmed: {
                type: Boolean,
                default: false
            }
        },

        // When a meetup was first confirmed. Kept when the plan changes afterwards, so proposing a new
        // meetup just before cancelling can't dodge the late-cancellation penalty (utils/trust.js).
        scheduledAt: Date,

        // The seller shows a QR code or a 6-digit code; only HMAC hashes are stored, never the values.
        handover: {
            codeHash: {
                type: String,
                select: false
            },
            tokenHash: {
                type: String,
                select: false
            },
            expiresAt: Date,
            attempts: {
                type: Number,
                default: 0
            },
            method: {
                type: String,
                enum: ["qr", "code"]
            },
            completedAt: Date
        },

        // null when the system cancelled it (listing removed, account suspended).
        cancelledBy: {
            type: ObjectId,
            ref: "User",
            default: null
        },
        cancelReason: {
            type: String,
            enum: CANCEL_REASONS
        },
        cancelNote: {
            type: String,
            trim: true,
            maxlength: 300
        },
        cancelledAt: Date,

        completedAt: Date,
        reviewedByBuyer: {
            type: Boolean,
            default: false
        },
        reviewedBySeller: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true,
        toJSON: {
            transform: (doc, ret) => {
                delete ret.handover?.codeHash;
                delete ret.handover?.tokenHash;
                delete ret.__v;
                return ret;
            }
        }
    }
);

dealSchema.index({ listing: 1 }, { unique: true, partialFilterExpression: { isOpen: true } });
dealSchema.index({ buyer: 1, status: 1 });
dealSchema.index({ seller: 1, status: 1 });
dealSchema.index({ conversation: 1 });
dealSchema.index({ swapCircle: 1 }, { sparse: true });

const Deal = mongoose.model("Deal", dealSchema);

export default Deal;
