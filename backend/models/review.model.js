import mongoose from "mongoose";
import { DEAL_ROLES, MAX_REVIEW_LENGTH } from "../config/constants.js";

const { ObjectId } = mongoose.Schema.Types;

// Left by each side of a completed deal, once (POST /api/deals/:id/review). Shown on the deal page
// and the reviewee's profile, and averaged into their trust score (utils/trust.js).
const reviewSchema = new mongoose.Schema(
    {
        deal: {
            type: ObjectId,
            ref: "Deal",
            required: true
        },

        listing: {
            type: ObjectId,
            ref: "Listing",
            required: true
        },

        reviewer: {
            type: ObjectId,
            ref: "User",
            required: true
        },

        // The other person in the deal.
        reviewee: {
            type: ObjectId,
            ref: "User",
            required: true
        },

        // The reviewer's side of the deal: "buyer" means the reviewer bought from the reviewee.
        role: {
            type: String,
            enum: DEAL_ROLES,
            required: true
        },

        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
            validate: { validator: Number.isInteger, message: "Pick 1 to 5 stars" }
        },

        comment: {
            type: String,
            trim: true,
            maxlength: MAX_REVIEW_LENGTH,
            default: ""
        }
    },
    { timestamps: true }
);

// One review per person per deal, even if "Submit" is pressed twice at once.
reviewSchema.index({ deal: 1, reviewer: 1 }, { unique: true });
// A profile's reviews, newest first (and the trust score's "latest review per reviewer").
reviewSchema.index({ reviewee: 1, createdAt: -1 });

const Review = mongoose.model("Review", reviewSchema);

export default Review;
