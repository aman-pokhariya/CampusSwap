import Listing from "../models/listing.model.js";
import { discoverable } from "./listingVisibility.js";
import { LISTING_STATUS } from "../config/constants.js";

const RELEASE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

// Reserves a listing for one deal. The deal id is generated before the deal itself is created and
// stored on the listing, so only that deal can ever release it. Returns null when the listing
// isn't available any more (someone else reserved it, it was sold, hidden or expired).
export const reserveListing = (listingId, dealId) =>
    Listing.findOneAndUpdate(
        { _id: listingId, ...discoverable() },
        { $set: { status: LISTING_STATUS.RESERVED, reservedFor: dealId } },
        { returnDocument: "after" }
    );

// Puts a reserved listing back on sale, but only if this deal still holds it (never "set it back
// to active" blindly). A listing whose expiry passed while it was reserved gets another week.
// One pipeline update keeps the whole release atomic.
export const releaseListing = (listingId, dealId) => {
    const now = new Date();
    return Listing.findOneAndUpdate(
        { _id: listingId, reservedFor: dealId },
        [
            {
                $set: {
                    status: LISTING_STATUS.ACTIVE,
                    expiresAt: {
                        $cond: [{ $lte: ["$expiresAt", now] }, new Date(now.getTime() + RELEASE_GRACE_MS), "$expiresAt"]
                    }
                }
            },
            { $unset: "reservedFor" }
        ],
        { returnDocument: "after", updatePipeline: true }
    );
};
