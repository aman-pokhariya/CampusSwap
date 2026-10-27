import mongoose from "mongoose";
import Campus from "../models/campus.model.js";
import User from "../models/user.model.js";
import Listing from "../models/listing.model.js";
import Review from "../models/review.model.js";
import ApiError from "../utils/ApiError.js";
import { toPoint } from "../models/schemas/point.schema.js";
import { setAuthCookie } from "../utils/authCookie.js";
import { deleteImage, uploadImage } from "../utils/storage.js";
import { toCards } from "../utils/listingCards.js";
import { canAdminCampus } from "../utils/admin.js";
import { blockedIdsFor, hasBlocked } from "../utils/blocks.js";
import { sameId } from "../utils/ids.js";
import { findPageBefore } from "../utils/paginate.js";
import { toPublicTrust } from "../utils/publicUser.js";
import { REVIEW_POPULATE, toReviewShape } from "../utils/reviews.js";
import { computeBadges, dealStats } from "../utils/trust.js";
import { discoverable, notHidden } from "../utils/listingVisibility.js";
import { disconnectUser } from "../socket/index.js";
import { CAMPUS_PUBLIC_FIELDS, LISTING_STATUS } from "../config/constants.js";

// How many reviews a profile shows before "Show more".
const PROFILE_REVIEWS = 5;

export const updateProfile = async (req, res) => {
    const { name, bio, hostel } = req.body;
    const user = req.user;

    if (name !== undefined) user.name = name;
    if (bio !== undefined) user.bio = bio;

    if (hostel !== undefined) {
        const campus = await Campus.findById(user.campus);

        if (hostel === "") {
            user.hostel = "";
            user.location = toPoint(campus.location);
        } else {
            const hostelPlace = campus.hostels.find((h) => h.name === hostel);
            if (!hostelPlace) {
                throw new ApiError(400, "Pick a hostel from the list", { errors: { hostel: "Unknown hostel for this campus" } });
            }
            user.hostel = hostelPlace.name;
            user.location = toPoint(hostelPlace.location);
        }
    }

    await user.save();
    await user.populate("campus", CAMPUS_PUBLIC_FIELDS);

    return res.json({ success: true, message: "Profile updated", user });
};

export const changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select("+password");

    if (!(await user.comparePassword(currentPassword))) {
        throw new ApiError(400, "Current password is incorrect", {
            errors: { currentPassword: "Current password is incorrect" }
        });
    }

    if (await user.comparePassword(newPassword)) {
        throw new ApiError(400, "New password must be different", {
            errors: { newPassword: "Choose a password you haven't used here" }
        });
    }

    user.password = newPassword;
    await user.save();

    // Saving set passwordChangedAt, which signs out every other device. Re-issue this device's cookie.
    setAuthCookie(res, user._id);

    // Drop every live connection once the new cookie is on its way: this tab reconnects with a fresh
    // socket token, while other devices can't get one and are logged out.
    res.once("finish", () => disconnectUser(user._id));

    return res.json({ success: true, message: "Password changed. Other devices have been logged out." });
};

export const updateAvatar = async (req, res) => {
    if (!req.file) {
        throw new ApiError(400, "Choose a photo to upload", { errors: { avatar: "Choose a photo" } });
    }

    const user = req.user;
    const oldPublicId = user.avatar?.publicId;

    user.avatar = await uploadImage(req.file, "avatars");
    await user.save();
    await deleteImage(oldPublicId);

    await user.populate("campus", CAMPUS_PUBLIC_FIELDS);
    return res.json({ success: true, message: "Profile photo updated", user });
};

export const removeAvatar = async (req, res) => {
    const user = req.user;
    const oldPublicId = user.avatar?.publicId;

    user.avatar = undefined;
    await user.save();
    await deleteImage(oldPublicId);

    await user.populate("campus", CAMPUS_PUBLIC_FIELDS);
    return res.json({ success: true, message: "Profile photo removed", user });
};

// A profile the viewer may see: verified, not banned, and on their campus (or one they administer).
const findVisibleProfile = async (id, viewer) => {
    if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Profile not found");

    const profile = await User.findById(id)
        .select("name avatar bio hostel campus createdAt isVerified isBanned trust")
        .populate("campus", "name shortName")
        .lean();

    const visible = profile && (sameId(profile.campus, viewer.campus) || canAdminCampus(viewer, profile.campus));
    if (!visible || !profile.isVerified || profile.isBanned) throw new ApiError(404, "Profile not found");
    return profile;
};

// Another student's public profile: trust, badges, latest reviews and their listings.
export const getProfile = async (req, res) => {
    const profile = await findVisibleProfile(req.params.id, req.user);
    const blockedIds = await blockedIdsFor(req.user._id);
    const blocked = blockedIds.some((id) => sameId(id, profile._id));

    const [listings, soldCount, dealCounts, latestReviews, blockedByMe] = await Promise.all([
        // Like every other list, a profile doesn't list the listings of a blocked pair (either way).
        blocked ? [] : Listing.find({ seller: profile._id, ...discoverable() }).sort({ createdAt: -1 }).limit(60).lean(),
        Listing.countDocuments({ seller: profile._id, status: LISTING_STATUS.SOLD, ...notHidden() }),
        dealStats(profile._id),
        findPageBefore(Review, { reviewee: profile._id }, { field: "createdAt", limit: PROFILE_REVIEWS }),
        hasBlocked(req.user._id, profile._id)
    ]);
    await Review.populate(latestReviews.rows, REVIEW_POPULATE);

    const trust = toPublicTrust(profile.trust);
    const badges = computeBadges({
        ...dealCounts,
        isVerified: profile.isVerified,
        ratingAvg: trust?.ratingAvg ?? 0,
        ratingCount: trust?.ratingCount ?? 0
    });
    const seller = { _id: profile._id, name: profile.name, avatar: profile.avatar, hostel: profile.hostel };

    return res.json({
        success: true,
        profile: {
            _id: profile._id,
            name: profile.name,
            avatar: profile.avatar,
            bio: profile.bio,
            hostel: profile.hostel,
            campus: profile.campus,
            createdAt: profile.createdAt,
            trust
        },
        badges,
        stats: { activeListings: listings.length, soldListings: soldCount, completedDeals: dealCounts.completedDeals },
        reviews: latestReviews.rows.map(toReviewShape),
        hasMoreReviews: latestReviews.hasMore,
        blockedByMe,
        listings: await toCards(listings.map((listing) => ({ ...listing, seller })), req.user)
    });
};

// "Show more" under a profile's reviews: ?before=<createdAt of the last review loaded>&limit=10.
export const getUserReviews = async (req, res) => {
    const profile = await findVisibleProfile(req.params.id, req.user);
    const { before, limit } = req.validatedQuery;

    const { rows, hasMore } = await findPageBefore(Review, { reviewee: profile._id }, { field: "createdAt", before, limit });
    await Review.populate(rows, REVIEW_POPULATE);

    return res.json({ success: true, reviews: rows.map(toReviewShape), hasMore });
};
