import Save from "../models/save.model.js";
import Campus from "../models/campus.model.js";
import { toPoint } from "../models/schemas/point.schema.js";
import { distanceMeters } from "./geo.js";
import { effectiveStatus } from "./listingVisibility.js";
import { MODERATION_STATE } from "../config/constants.js";

// Where distances are measured from: the user's hostel, or their campus centre.
export const originFor = async (user) => {
    if (user.location?.coordinates) return toPoint(user.location);
    const campus = await Campus.findById(user.campus).select("location");
    return toPoint(campus.location);
};

// Cards only need the cover photo, not every photo and the full description. A listing past its
// expiry date already shows as expired, even before the expiry job has marked it.
export const toCard = ({ images = [], description, location, campus, moderation, expiryReminderSent, interestCount, __v, ...rest }) => ({
    ...rest,
    status: effectiveStatus(rest),
    // Only owners ever see a listing that isn't "ok" (hidden ones never reach anyone else's lists).
    moderation: { state: moderation?.state ?? MODERATION_STATE.OK, reason: moderation?.reason },
    images: images.slice(0, 1),
    imageCount: images.length
});

// Adds isSaved (and distance, when the query didn't calculate it) for the current user.
// `listings` are plain objects (.lean() or aggregate results).
export const decorate = async (listings, user, origin) => {
    if (listings.length === 0) return [];

    const savedIds = new Set(
        (await Save.find({ user: user._id, listing: { $in: listings.map((l) => l._id) } }).distinct("listing")).map(String)
    );

    return listings.map((listing) => {
        const distance = listing.distance ?? distanceMeters(origin, listing.location);
        return {
            ...listing,
            isSaved: savedIds.has(String(listing._id)),
            distance: distance == null ? null : Math.round(distance)
        };
    });
};

// The usual pipeline for lists loaded with find(): decorate for the user, then trim to cards.
export const toCards = async (listings, user) =>
    (await decorate(listings, user, await originFor(user))).map(toCard);
