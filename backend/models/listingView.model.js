import mongoose from "mongoose";

// Remembers that someone viewed a listing, for 24 hours. While a row exists, refreshing the
// page doesn't add another view, so view counts can't be inflated.
const listingViewSchema = new mongoose.Schema({
    listing: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Listing",
        required: true
    },

    viewer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    // TTL index: MongoDB deletes the row after 24 hours, so the next visit counts again.
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 60 * 60 * 24
    }
});

listingViewSchema.index({ listing: 1, viewer: 1 }, { unique: true });

const ListingView = mongoose.model("ListingView", listingViewSchema);

export default ListingView;
