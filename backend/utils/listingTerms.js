import Listing from "../models/listing.model.js";
import ApiError from "./ApiError.js";
import { discoverable, isDiscoverable } from "./listingVisibility.js";

// A new chat takes who buys and who sells from the listing's type, and a rent offer counts in the
// listing's rent period ("₹40/day × 7"). Before creating either, this bumps the listing's interestCount,
// but only while the type and rent period are still the ones the caller read (and it's still available).
// An edit that changes them only saves if interestCount didn't move meanwhile (updateListing). Both
// sides write to the same listing document, so whichever comes second fails: a chat or an offer can
// never be set up under terms that were just changed. `unavailableError` is the caller's own error.
export const claimListingTerms = async (listing, unavailableError) => {
    const { matchedCount } = await Listing.updateOne(
        { _id: listing._id, type: listing.type, rentPeriod: listing.rentPeriod ?? null, ...discoverable() },
        { $inc: { interestCount: 1 } },
        { timestamps: false }
    );
    if (matchedCount > 0) return;

    const current = await Listing.findById(listing._id).lean();
    if (!current || !isDiscoverable(current)) throw unavailableError();
    throw new ApiError(409, "This listing just changed — take another look", { code: "LISTING_CHANGED" });
};
