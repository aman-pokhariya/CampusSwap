import mongoose from "mongoose";
import pointSchema from "./schemas/point.schema.js";
import {
    LISTING_CATEGORIES,
    LISTING_CONDITIONS,
    LISTING_LIFETIME_DAYS,
    LISTING_STATUS,
    LISTING_TYPES,
    MAX_LISTING_IMAGES,
    MODERATION_STATE,
    RENT_PERIODS
} from "../config/constants.js";

const imageSchema = new mongoose.Schema(
    {
        url: {
            type: String,
            required: true
        },
        // Needed to delete the file from Cloudinary (or local disk) later.
        publicId: {
            type: String,
            required: true
        }
    },
    { _id: false }
);

const listingSchema = new mongoose.Schema(
    {
        seller: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        // Listings are only visible on their own campus.
        campus: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Campus",
            required: true
        },

        type: {
            type: String,
            enum: LISTING_TYPES,
            required: true
        },

        title: {
            type: String,
            required: true,
            trim: true,
            minlength: 3,
            maxlength: 80
        },

        description: {
            type: String,
            trim: true,
            maxlength: 1000,
            default: ""
        },

        category: {
            type: String,
            enum: LISTING_CATEGORIES,
            required: true
        },

        // Optional only for "wanted" posts.
        condition: {
            type: String,
            enum: LISTING_CONDITIONS
        },

        // Whole rupees. sell/kit: price · rent: price per rentPeriod · swap: optional cash
        // alternative · wanted: optional budget · free: always 0.
        price: {
            type: Number,
            min: 0
        },

        rentPeriod: {
            type: String,
            enum: RENT_PERIODS
        },

        // What a "swap" lister wants in exchange.
        swapFor: {
            type: String,
            trim: true,
            maxlength: 120,
            default: ""
        },

        negotiable: {
            type: Boolean,
            default: true
        },

        // What a semester kit contains.
        kitItems: [
            {
                type: String,
                trim: true,
                maxlength: 60
            }
        ],

        // The first image is the cover.
        images: {
            type: [imageSchema],
            validate: {
                validator: (images) => images.length <= MAX_LISTING_IMAGES,
                message: `A listing can have up to ${MAX_LISTING_IMAGES} photos`
            }
        },

        // Copied from the seller when posting: where the item is.
        hostel: {
            type: String,
            default: ""
        },

        location: {
            type: pointSchema,
            required: true
        },

        // Lifecycle only: active → reserved (a deal holds it) → sold, or expired.
        // Whether it may be shown at all is decided by `moderation` and `deletedAt` (utils/listingVisibility.js).
        status: {
            type: String,
            enum: Object.values(LISTING_STATUS),
            default: LISTING_STATUS.ACTIVE
        },

        // "flagged" (waiting for an admin) and "removed" hide the listing without touching its status.
        moderation: {
            state: {
                type: String,
                enum: Object.values(MODERATION_STATE),
                default: MODERATION_STATE.OK
            },
            reason: String,
            source: {
                type: String,
                enum: ["reports", "ai", "admin"]
            },
            at: Date,
            // Hash of the text that was last checked, so unchanged edits aren't checked again.
            textHash: String
        },

        // Set instead of deleting when chats or deals still point at the listing (they keep its photos).
        deletedAt: {
            type: Date,
            default: null
        },

        // The deal holding the reservation. Only that deal may release it (utils/reservations.js).
        reservedFor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Deal"
        },

        // Rent deals: when the item is due back.
        rentedUntil: Date,

        // Goes up by one each time a chat starts or an offer is made (utils/listingTerms.js). Both are set up
        // under the listing's type (who buys, who sells) and rent period at that moment, so an edit that
        // changes either one only saves if this didn't move while its photos were uploading.
        // No default on purpose: older listings don't have it, and the edit's check has to match that.
        interestCount: Number,

        views: {
            type: Number,
            default: 0
        },

        saves: {
            type: Number,
            default: 0
        },

        soldAt: Date,

        expiresAt: {
            type: Date,
            default: () => new Date(Date.now() + LISTING_LIFETIME_DAYS * 24 * 60 * 60 * 1000)
        },

        // The "expires in 3 days" reminder went out. Cleared when the listing is relisted.
        expiryReminderSent: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true,
        toJSON: {
            transform: (doc, ret) => {
                delete ret.__v;
                delete ret.expiryReminderSent;
                delete ret.interestCount;
                if (ret.moderation) delete ret.moderation.textHash;
                return ret;
            }
        }
    }
);

// The feed's two paths. "Nearest" and the distance filter use $geoNear on this compound 2dsphere index, so
// only active listings of the user's campus are searched. Every other sort reads this campus's active listings
// from the second index; with _id in it (the tie-breaker), "newest" needs no sorting and stops once a page is full.
listingSchema.index({ campus: 1, status: 1, location: "2dsphere" });
listingSchema.index({ campus: 1, status: 1, createdAt: -1, _id: -1 });
listingSchema.index({ seller: 1, createdAt: -1 });

const Listing = mongoose.model("Listing", listingSchema);

export default Listing;
