import Deal from "../models/deal.model.js";
import Listing from "../models/listing.model.js";
import Report from "../models/report.model.js";
import User from "../models/user.model.js";
import env from "../config/env.js";
import { notify } from "./notify.js";
import { isHidden } from "./listingVisibility.js";
import { announceListingChange } from "./chat.js";
import { emitDealUpdate } from "./deals.js";
import { closeListingNegotiations, coverOf } from "./offers.js";
import {
    AUTO_FLAG_CAMPUS_HOURLY_CAP,
    AUTO_FLAG_REPORTS,
    AUTO_FLAG_TRUSTED_DEALS,
    MODERATION_STATE,
    REPORT_STATUS
} from "../config/constants.js";

const HOUR_MS = 60 * 60 * 1000;

// Decided once, when a report is filed: may it count towards hiding a listing automatically? Only
// reports from verified accounts older than REPORT_MIN_ACCOUNT_AGE_HOURS do, and once someone has
// filed 3 or more reports, fewer than half of them may have been dismissed. This keeps a handful of
// fresh accounts (or one serial false-reporter) from taking listings down.
export const countsTowardFlag = (reporter, now = new Date()) => {
    const ageHours = (now - reporter.createdAt) / HOUR_MS;
    const { filed = 0, dismissed = 0 } = reporter.reportStats ?? {};
    return Boolean(reporter.isVerified) && ageHours >= env.REPORT_MIN_ACCOUNT_AGE_HOURS && (filed < 3 || dismissed / filed < 0.5);
};

// Hides a listing until an admin has looked at it. Only moves it from "ok" (an earlier flag or a
// removal is never overwritten), then closes every negotiation on it, refreshes its chats and its open
// deal (which can still be cancelled, nothing else), and tells the owner without saying who reported
// it. Returns the flagged listing, or null when it wasn't "ok". AI moderation (Chunk 5) uses it too.
export const flagListing = async (listingId, { source, reason }) => {
    const flagged = await Listing.findOneAndUpdate(
        { _id: listingId, "moderation.state": { $nin: [MODERATION_STATE.FLAGGED, MODERATION_STATE.REMOVED] } },
        {
            $set: {
                "moderation.state": MODERATION_STATE.FLAGGED,
                "moderation.source": source,
                "moderation.reason": reason,
                "moderation.at": new Date()
            }
        },
        { returnDocument: "after" }
    ).lean();
    if (!flagged) return null;

    await closeListingNegotiations(flagged._id, { reason: "flagged" });
    await announceListingChange(flagged);
    const openDeal = await Deal.findOne({ listing: flagged._id, isOpen: true }).select("_id").lean();
    if (openDeal) await emitDealUpdate(openDeal._id);

    await notify(flagged.seller, {
        type: "listing_flagged",
        title: "Your listing is being reviewed",
        body: `“${flagged.title}” is hidden while our team takes a look. We'll let you know once it's checked.`,
        link: `/listings/${flagged._id}`,
        image: coverOf(flagged)
    });
    return flagged;
};

// Runs after a counting report on a listing. Once AUTO_FLAG_REPORTS different students' counting reports
// are open, the listing is hidden for review, except:
// - the owner has AUTO_FLAG_TRUSTED_DEALS completed deals: their reports wait for an admin instead;
// - AUTO_FLAG_CAMPUS_HOURLY_CAP listings on the campus were already auto-hidden in the last hour, a brake on
//   coordinated mass-reporting. It's counted from the database, so a restart doesn't reset it (two reports
//   landing at the very same moment could both pass it: it's a brake, not an exact quota).
// Returns the flagged listing, or null.
export const autoFlagIfReported = async (listing) => {
    if (isHidden(listing)) return null;

    const reporters = await Report.distinct("reporter", {
        targetType: "listing",
        listing: listing._id,
        status: REPORT_STATUS.OPEN,
        countsTowardFlag: true
    });
    if (reporters.length < AUTO_FLAG_REPORTS) return null;

    const owner = await User.findById(listing.seller).select("trust.completedDeals").lean();
    if ((owner?.trust?.completedDeals ?? 0) >= AUTO_FLAG_TRUSTED_DEALS) return null;

    const flaggedLastHour = await Listing.countDocuments({
        campus: listing.campus,
        "moderation.source": "reports",
        "moderation.at": { $gt: new Date(Date.now() - HOUR_MS) }
    });
    if (flaggedLastHour >= AUTO_FLAG_CAMPUS_HOURLY_CAP) return null;

    return flagListing(listing._id, { source: "reports", reason: "Reported by several students" });
};
