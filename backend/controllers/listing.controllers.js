import mongoose from "mongoose";
import Conversation from "../models/conversation.model.js";
import Deal from "../models/deal.model.js";
import Listing from "../models/listing.model.js";
import ListingView from "../models/listingView.model.js";
import Offer from "../models/offer.model.js";
import Save from "../models/save.model.js";
import ApiError from "../utils/ApiError.js";
import { deleteImages, uploadImages } from "../utils/storage.js";
import { distanceMeters } from "../utils/geo.js";
import { escapeRegex } from "../utils/regex.js";
import { decorate, originFor, toCard, toCards } from "../utils/listingCards.js";
import { findListing, findOwnedListing } from "../utils/listingAccess.js";
import { blockedIdsFor } from "../utils/blocks.js";
import { publicUserProjection } from "../utils/publicUser.js";
import { discoverable, effectiveStatus, isHidden, notHidden } from "../utils/listingVisibility.js";
import { closeListingNegotiations } from "../utils/offers.js";
import { announceListingChange } from "../utils/chat.js";
import {
    LISTING_LIFETIME_DAYS,
    LISTING_STATUS,
    MAX_LISTING_IMAGES,
    MODERATION_STATE,
    OFFER_STATUS,
    OWNER_TRANSITIONS,
    PROFILE_USER_FIELDS,
    PUBLIC_USER_FIELDS
} from "../config/constants.js";

// ── Helpers ───────────────────────────────────────────────

const SORTS = {
    newest: { createdAt: -1, _id: -1 },
    nearest: { distance: 1, createdAt: -1 },
    "price-asc": { price: 1, createdAt: -1 },
    "price-desc": { price: -1, createdAt: -1 },
    relevance: { relevance: -1, createdAt: -1 }
};

const LIFETIME_MS = LISTING_LIFETIME_DAYS * 24 * 60 * 60 * 1000;

const reservedError = () => new ApiError(409, "Finish or cancel the deal first", { code: "LISTING_RESERVED" });

const removedError = () => new ApiError(403, "This listing was removed by a moderator, so it can't be edited", { code: "LISTING_REMOVED" });

// Who buys and who sells was fixed when each chat started, and a rent offer counts in the listing's rent
// period ("₹40/day × 7"), so neither may change under them. Returns the error to show, or null.
const termsLockError = async (listingId, { typeChanged, periodChanged }) => {
    if (typeChanged && (await Conversation.exists({ listing: listingId }))) {
        const message = "You can't change the type after people have messaged you";
        return new ApiError(400, message, { errors: { type: message } });
    }
    // An offer past its expiry date can't be accepted any more, so it doesn't count.
    if (periodChanged && (await Offer.exists({ listing: listingId, status: OFFER_STATUS.PENDING, expiresAt: { $gt: new Date() } }))) {
        const message = "You can't change the rent period while an offer is waiting for a reply";
        return new ApiError(400, message, { errors: { rentPeriod: message } });
    }
    return null;
};

// Re-reads a listing whose save matched nothing (it changed while the photos were uploading), to say why.
const staleEditError = async (listingId, termChanges) => {
    const current = await Listing.findById(listingId).lean();
    if (!current || current.deletedAt) return new ApiError(404, "Listing not found");
    if (current.status === LISTING_STATUS.RESERVED) return reservedError();
    if (current.moderation?.state === MODERATION_STATE.REMOVED) return removedError();
    return (await termsLockError(listingId, termChanges))
        ?? new ApiError(409, "This listing just changed. Reload it and try again", { code: "LISTING_CHANGED" });
};

// Counts a view at most once per viewer per 24 hours (see ListingView).
const recordView = async (listingId, viewerId) => {
    try {
        await ListingView.create({ listing: listingId, viewer: viewerId });
    } catch (err) {
        if (err.code === 11000) return false;
        throw err;
    }
    await Listing.updateOne({ _id: listingId }, { $inc: { views: 1 } });
    return true;
};

// ── Feed ──────────────────────────────────────────────────

export const getFeed = async (req, res) => {
    const { q, type, category, condition, minPrice, maxPrice, within, page, limit } = req.validatedQuery;
    const user = req.user;

    const words = q ? q.split(/\s+/).filter(Boolean).slice(0, 6).map(escapeRegex) : [];
    const sort = req.validatedQuery.sort === "relevance" && words.length === 0 ? "newest" : req.validatedQuery.sort;

    // Only listings that are live: active, not hidden, not past their expiry date. Listings of people
    // I blocked, or who blocked me, are left out of every list (feed, search, similar, profiles);
    // a direct link still opens.
    const [blockedIds, origin] = await Promise.all([blockedIdsFor(user._id), originFor(user)]);
    const match = { campus: user.campus, ...discoverable() };
    if (blockedIds.length > 0) match.seller = { $nin: blockedIds };
    if (type) match.type = type;
    if (category) match.category = category;
    if (condition) match.condition = condition;

    if (minPrice !== undefined || maxPrice !== undefined || sort.startsWith("price")) {
        match.price = { $ne: null };
        if (minPrice !== undefined) match.price.$gte = minPrice;
        if (maxPrice !== undefined) match.price.$lte = maxPrice;
    }

    // Every word must appear somewhere: "dsa book" finds "Book: DSA by Cormen". Plain regex
    // (not a $text index) so partial words work while typing: "calc" finds "calculator".
    if (words.length > 0) {
        match.$and = words.map((word) => {
            const regex = new RegExp(word, "i");
            return { $or: [{ title: regex }, { description: regex }, { swapFor: regex }, { kitItems: regex }] };
        });
    }

    // Only "nearest" and the distance filter need MongoDB to measure distances. Every other sort is a plain
    // match and sort on the { campus, status, createdAt, _id } index, and the card distances are worked
    // out in code (decorate), the same way as on every other list.
    const byDistance = sort === "nearest" || within !== undefined;
    const pipeline = [
        byDistance
            ? {
                // $geoNear must come first: it filters with `query` and adds `distance` (metres) to every listing.
                // `key` names the field, as an older location-only 2dsphere index may still exist next to
                // the { campus, status, location } one (then MongoDB can't choose by itself).
                $geoNear: {
                    near: origin,
                    key: "location",
                    distanceField: "distance",
                    spherical: true,
                    query: match,
                    ...(within && { maxDistance: within })
                }
            }
            : { $match: match }
    ];

    if (sort === "relevance") {
        // A match in the title counts 3x more than one in the description.
        const scores = words.map((word) => ({
            $add: [
                { $cond: [{ $regexMatch: { input: "$title", regex: word, options: "i" } }, 3, 0] },
                { $cond: [{ $regexMatch: { input: "$description", regex: word, options: "i" } }, 1, 0] }
            ]
        }));
        pipeline.push({ $addFields: { relevance: { $add: scores } } });
    }

    pipeline.push(
        { $sort: SORTS[sort] },
        { $skip: (page - 1) * limit },
        // One extra row tells us whether another page exists, without a separate count query.
        { $limit: limit + 1 },
        {
            $lookup: {
                from: "users",
                localField: "seller",
                foreignField: "_id",
                as: "seller",
                pipeline: [{ $project: publicUserProjection }]
            }
        },
        { $unwind: "$seller" }
    );

    let results;
    try {
        results = await Listing.aggregate(pipeline);
    } catch (err) {
        // $geoNear needs its 2dsphere index. On a brand-new (or wiped) database Mongoose may not
        // have built it yet, so build it now and try once more instead of failing.
        if (!byDistance || !/2dsphere index|index for \$geoNear/i.test(err.message)) throw err;
        await Listing.createIndexes();
        results = await Listing.aggregate(pipeline);
    }
    const hasMore = results.length > limit;
    const listings = await decorate(results.slice(0, limit), user, origin);

    return res.json({ success: true, listings: listings.map(toCard), page, hasMore });
};

// ── Single listing ────────────────────────────────────────

// Reserved, sold and expired listings still open (the page shows a status banner). Hidden ones only
// open for their owner and campus admins.
export const getListing = async (req, res) => {
    const listing = await findListing(req.params.id, req.user, { allowHidden: true });
    await listing.populate("seller", PROFILE_USER_FIELDS);

    const isOwner = listing.seller._id.equals(req.user._id);
    if (!isOwner && !isHidden(listing) && (await recordView(listing._id, req.user._id))) listing.views += 1;

    const [origin, blockedIds] = await Promise.all([originFor(req.user), blockedIdsFor(req.user._id)]);
    const [isSaved, activeListings, similar] = await Promise.all([
        Save.exists({ user: req.user._id, listing: listing._id }),
        Listing.countDocuments({ seller: listing.seller._id, ...discoverable() }),
        Listing.find({
            campus: listing.campus,
            category: listing.category,
            _id: { $ne: listing._id },
            seller: { $nin: blockedIds },
            ...discoverable()
        })
            .sort({ createdAt: -1 })
            .limit(4)
            .populate("seller", PUBLIC_USER_FIELDS)
            .lean()
    ]);

    const details = listing.toJSON();
    // "Last seen" is only shared between people who haven't blocked each other.
    if (blockedIds.some((id) => id.equals(listing.seller._id))) delete details.seller.lastSeenAt;

    return res.json({
        success: true,
        listing: {
            ...details,
            status: effectiveStatus(listing),
            isSaved: Boolean(isSaved),
            distance: distanceMeters(origin, listing.location)
        },
        sellerStats: { activeListings },
        similar: await toCards(similar, req.user)
    });
};

// Puts kept and newly uploaded photos in the order the seller arranged them in the form.
// Falls back to "kept first, then new" if the order doesn't describe exactly these photos.
const arrangeImages = (kept, added, imageOrder) => {
    const fallback = [...kept, ...added];
    if (imageOrder.length !== fallback.length) return fallback;

    const ordered = imageOrder.map((token) =>
        token.startsWith("k:") ? kept.find((image) => image.publicId === token.slice(2)) : added[Number(token.slice(2))]
    );
    const complete = ordered.every(Boolean) && new Set(ordered.map((image) => image.publicId)).size === fallback.length;
    return complete ? ordered : fallback;
};

export const createListing = async (req, res) => {
    const { keepImages, imageOrder, ...data } = req.body;
    const files = req.files ?? [];

    if (data.type !== "wanted" && files.length === 0) {
        throw new ApiError(400, "Add at least one photo", { errors: { images: "Add at least one photo" } });
    }

    const location = await originFor(req.user);
    const images = await uploadImages(files, "listings");

    try {
        const listing = await Listing.create({
            ...data,
            images,
            seller: req.user._id,
            campus: req.user.campus,
            hostel: req.user.hostel,
            location
        });
        return res.status(201).json({ success: true, message: "Your listing is live! 🎉", listing });
    } catch (err) {
        await deleteImages(images); // don't leave orphaned photos in storage
        throw err;
    }
};

export const updateListing = async (req, res) => {
    const listing = await findOwnedListing(req.params.id, req.user);
    const { keepImages, imageOrder, ...data } = req.body;
    const files = req.files ?? [];
    const termChanges = {
        typeChanged: data.type !== listing.type,
        periodChanged: data.type === "rent" && listing.type === "rent" && data.rentPeriod !== listing.rentPeriod
    };

    if (listing.status === LISTING_STATUS.RESERVED) throw reservedError();
    if (listing.moderation?.state === MODERATION_STATE.REMOVED) throw removedError();
    const lockError = await termsLockError(listing._id, termChanges);
    if (lockError) throw lockError;

    // Only photos that really belong to this listing can be kept.
    const kept = keepImages.map((id) => listing.images.find((image) => image.publicId === id)).filter(Boolean);
    const total = kept.length + files.length;

    if (total > MAX_LISTING_IMAGES) {
        throw new ApiError(400, `You can add up to ${MAX_LISTING_IMAGES} photos`, { errors: { images: `Up to ${MAX_LISTING_IMAGES} photos` } });
    }
    if (data.type !== "wanted" && total === 0) {
        throw new ApiError(400, "Add at least one photo", { errors: { images: "Add at least one photo" } });
    }

    const added = await uploadImages(files, "listings");
    const removed = listing.images.filter((image) => !kept.some((k) => k.publicId === image.publicId));

    // Pending offers keep their amounts on a price change: each one names its own price.
    // A listing under review stays under review: only an admin can approve it.
    Object.assign(listing, data);
    listing.images = arrangeImages(kept, added, imageOrder);
    // The item is wherever the seller lives now.
    listing.hostel = req.user.hostel;
    listing.location = await originFor(req.user);

    // The checks above ran on the copy loaded before the upload, which can take a while: the save only
    // matches if the listing still isn't reserved (an accept), removed or deleted. A chat or offer that
    // started meanwhile was set up under the old type and rent period, so a change to either one also
    // needs interestCount to be unchanged (see utils/listingTerms.js).
    listing.$where = {
        seller: req.user._id,
        status: { $ne: LISTING_STATUS.RESERVED },
        "moderation.state": { $ne: MODERATION_STATE.REMOVED },
        deletedAt: null,
        ...((termChanges.typeChanged || termChanges.periodChanged) && { interestCount: listing.interestCount ?? null })
    };

    try {
        await listing.save();
    } catch (err) {
        await deleteImages(added);
        // Nothing matched. (Saving a new photo array also checks the version, so that miss is a VersionError.)
        if (err instanceof mongoose.Error.DocumentNotFoundError || err instanceof mongoose.Error.VersionError) {
            throw await staleEditError(listing._id, termChanges);
        }
        throw err;
    }

    await deleteImages(removed);
    return res.json({ success: true, message: "Listing updated", listing });
};

// Statuses a listing can be in for the owner to move it to `status` (see OWNER_TRANSITIONS).
const sourcesFor = (status) => Object.keys(OWNER_TRANSITIONS).filter((from) => OWNER_TRANSITIONS[from].includes(status));

// "Mark sold", "Put back on sale" and "Relist", as one conditional update: it only matches while the
// listing is in a status that allows the change and isn't under review, so it can't race a deal.
export const updateListingStatus = async (req, res) => {
    const listing = await findOwnedListing(req.params.id, req.user);
    const { status } = req.body;
    const now = new Date();

    // An active listing past its expiry date already counts as expired: it can be relisted, but it
    // can't be marked sold (expired → sold isn't an owner transition).
    const fromFilter = status === LISTING_STATUS.ACTIVE
        ? { $or: [{ status: { $in: sourcesFor(status) } }, { status: LISTING_STATUS.ACTIVE, expiresAt: { $lte: now } }] }
        : { status: LISTING_STATUS.ACTIVE, expiresAt: { $gt: now } };

    const update = status === LISTING_STATUS.SOLD
        ? { $set: { status, soldAt: now } }
        // Back on sale: a full new lifetime (and a new expiry reminder later on).
        : { $set: { status, expiresAt: new Date(now.getTime() + LIFETIME_MS), expiryReminderSent: false }, $unset: { soldAt: 1, rentedUntil: 1 } };

    const updated = await Listing.findOneAndUpdate(
        { _id: listing._id, seller: req.user._id, ...notHidden(), ...fromFilter },
        update,
        { returnDocument: "after" }
    );

    if (!updated) {
        // Re-read to explain why not.
        const current = await Listing.findById(listing._id).lean();
        if (!current || current.deletedAt) throw new ApiError(404, "Listing not found");
        if (isHidden(current)) throw new ApiError(403, "This listing is under review", { code: "LISTING_UNDER_REVIEW" });
        if (current.status === LISTING_STATUS.RESERVED) throw reservedError();
        if (effectiveStatus(current) === status) {
            throw new ApiError(409, `This listing is already ${status === LISTING_STATUS.SOLD ? "sold" : "on sale"}`, { code: "STATUS_UNCHANGED" });
        }
        throw new ApiError(409, "You can't change this listing to that status", { code: "INVALID_TRANSITION" });
    }

    if (status === LISTING_STATUS.SOLD) {
        await closeListingNegotiations(updated._id, { reason: "sold", actorId: req.user._id });
    }
    await announceListingChange(updated, { event: status === LISTING_STATUS.SOLD ? "listing_sold" : undefined, actorId: req.user._id });

    const message = status === LISTING_STATUS.SOLD ? "Marked as sold 🎉" : "Back on sale";
    return res.json({ success: true, message, listing: updated });
};

// A listing that chats or deals point at is only hidden (deletedAt), so they keep its title and
// photos. Anything else is deleted for good, with its photos, saves and views.
export const deleteListing = async (req, res) => {
    const listing = await findOwnedListing(req.params.id, req.user, { allowAdmin: true });
    if (listing.status === LISTING_STATUS.RESERVED) throw reservedError();

    // Soft delete first, always: from here on no new chat, offer or reservation can start. Only then
    // look for chats and deals (a chat created at this moment re-checks the listing afterwards, see
    // findOrCreateConversation), so a hard delete never leaves a chat pointing at nothing.
    const deleted = await Listing.findOneAndUpdate(
        { _id: listing._id, status: { $ne: LISTING_STATUS.RESERVED }, deletedAt: null },
        { $set: { deletedAt: new Date() } },
        { returnDocument: "after" }
    );
    // A deal reserved it a moment ago (or another request deleted it first).
    if (!deleted) throw (await Listing.exists({ _id: listing._id, deletedAt: null })) ? reservedError() : new ApiError(404, "Listing not found");

    const [hasChats, hasDeals] = await Promise.all([
        Conversation.exists({ listing: listing._id }),
        Deal.exists({ listing: listing._id })
    ]);

    if (hasChats || hasDeals) {
        await closeListingNegotiations(deleted._id, { reason: "deleted", actorId: req.user._id });
        await announceListingChange(deleted, { event: "listing_deleted", actorId: req.user._id });
        return res.json({ success: true, message: "Listing deleted" });
    }

    await Listing.findOneAndDelete({ _id: listing._id, deletedAt: deleted.deletedAt });
    await Promise.all([
        Save.deleteMany({ listing: listing._id }),
        ListingView.deleteMany({ listing: listing._id })
    ]);
    await deleteImages(deleted.images);

    return res.json({ success: true, message: "Listing deleted" });
};

// ── Saved (wishlist) ──────────────────────────────────────

// PUT and DELETE (instead of a "toggle") are idempotent: a double-tap can never get the
// heart and the counter out of sync.
export const saveListing = async (req, res) => {
    const listing = await findListing(req.params.id, req.user);

    try {
        await Save.create({ user: req.user._id, listing: listing._id });
        await Listing.updateOne({ _id: listing._id }, { $inc: { saves: 1 } });
    } catch (err) {
        if (err.code !== 11000) throw err; // already saved: nothing to do
    }
    return res.json({ success: true, saved: true });
};

export const unsaveListing = async (req, res) => {
    const listing = await findListing(req.params.id, req.user);

    const removed = await Save.findOneAndDelete({ user: req.user._id, listing: listing._id });
    if (removed) await Listing.updateOne({ _id: listing._id }, { $inc: { saves: -1 } });

    return res.json({ success: true, saved: false });
};

// Saved listings that are under review, removed or deleted drop out of the list; reserved, sold
// and expired ones stay, with their status.
export const getSavedListings = async (req, res) => {
    const saves = await Save.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .limit(100)
        .populate({ path: "listing", populate: { path: "seller", select: PUBLIC_USER_FIELDS } })
        .lean();

    const listings = saves.map((save) => save.listing).filter((listing) => listing && !isHidden(listing));

    return res.json({ success: true, listings: await toCards(listings, req.user) });
};

// ── My listings ───────────────────────────────────────────

export const getMyListings = async (req, res) => {
    const listings = (await Listing.find({ seller: req.user._id, deletedAt: null }).sort({ createdAt: -1 }).limit(200).lean()).map(toCard);

    const stats = {
        active: listings.filter((l) => l.status === LISTING_STATUS.ACTIVE && !isHidden(l)).length,
        sold: listings.filter((l) => l.status === LISTING_STATUS.SOLD).length,
        views: listings.reduce((sum, l) => sum + l.views, 0),
        saves: listings.reduce((sum, l) => sum + l.saves, 0)
    };

    return res.json({ success: true, listings, stats });
};
