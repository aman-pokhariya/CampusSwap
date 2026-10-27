import mongoose from "mongoose";

// A listing in someone's wishlist. Its own collection (not an array on User) so it scales,
// and so Listing.saves can be kept as a simple counter.
const saveSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        listing: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Listing",
            required: true
        }
    },
    { timestamps: true }
);

// The unique index makes saving idempotent: saving twice can never create two rows.
saveSchema.index({ user: 1, listing: 1 }, { unique: true });
saveSchema.index({ user: 1, createdAt: -1 });

const Save = mongoose.model("Save", saveSchema);

export default Save;
