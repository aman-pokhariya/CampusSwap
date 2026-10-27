import mongoose from "mongoose";
import Listing from "../models/listing.model.js";
import ApiError from "./ApiError.js";
import { canAdminCampus } from "./admin.js";
import { isHidden } from "./listingVisibility.js";

// Loads a listing the user may see: one on their own campus (admins: the campuses they manage).
// Hidden listings (under review, removed or deleted) are a 404, unless the caller passes allowHidden
// and the user is the owner or a campus admin.
export const findListing = async (id, user, { allowHidden = false } = {}) => {
    if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Listing not found");

    const listing = await Listing.findById(id);
    if (!listing) throw new ApiError(404, "Listing not found");

    const isCampusAdmin = canAdminCampus(user, listing.campus);
    const mayOpenHidden = allowHidden && (listing.seller.equals(user._id) || isCampusAdmin);
    if ((!listing.campus.equals(user.campus) && !isCampusAdmin) || (isHidden(listing) && !mayOpenHidden)) {
        throw new ApiError(404, "Listing not found");
    }
    return listing;
};

// The owner's listing (or, with allowAdmin, any listing a campus admin manages). Listings under
// review are included so their owner can still act on them; deleted ones are gone for good.
export const findOwnedListing = async (id, user, { allowAdmin = false } = {}) => {
    const listing = await findListing(id, user, { allowHidden: true });
    if (listing.deletedAt) throw new ApiError(404, "Listing not found");

    if (!listing.seller.equals(user._id) && !(allowAdmin && canAdminCampus(user, listing.campus))) {
        throw new ApiError(403, "Only the seller can change this listing");
    }
    return listing;
};
