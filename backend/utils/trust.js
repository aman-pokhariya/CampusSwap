import mongoose from "mongoose";
import Deal from "../models/deal.model.js";
import Report from "../models/report.model.js";
import Review from "../models/review.model.js";
import User from "../models/user.model.js";
import { idOf } from "./ids.js";
import { DEAL_STATUS, REPORT_STATUS, UPHELD_REPORT_ACTIONS } from "../config/constants.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const CANCELLATION_WINDOW_DAYS = 180;

const toObjectId = (id) => new mongoose.Types.ObjectId(idOf(id));

// Counts from a user's completed deals, in one aggregation. `counterparts` and `sales` count
// different people, so two friends trading back and forth only count once.
export const dealStats = async (userId) => {
    const me = toObjectId(userId);
    const count = { $count: "n" };

    const [facets] = await Deal.aggregate([
        { $match: { status: DEAL_STATUS.COMPLETED, $or: [{ buyer: me }, { seller: me }] } },
        {
            $facet: {
                total: [count],
                counterparts: [{ $group: { _id: { $cond: [{ $eq: ["$buyer", me] }, "$seller", "$buyer"] } } }, count],
                sales: [{ $match: { seller: me } }, { $group: { _id: "$buyer" } }, count],
                freeGiven: [{ $match: { seller: me, listingType: "free" } }, count],
                // The deals of one swap circle are one swap.
                swaps: [{ $match: { listingType: "swap" } }, { $group: { _id: { $ifNull: ["$swapCircle", "$_id"] } } }, count]
            }
        }
    ]);
    const n = (facet) => facets?.[facet][0]?.n ?? 0;

    return {
        completedDeals: n("total"),
        counterparts: n("counterparts"),
        sales: n("sales"),
        freeGiven: n("freeGiven"),
        swaps: n("swaps")
    };
};

// The trust score (0–100) on profiles, deal cards and listing pages, saved on user.trust:
//   completedDeals = how many DIFFERENT people they completed a deal with (no farming with a friend)
//   ratings        = only each reviewer's latest review → average and count
//   cancellations  = deals they cancelled in the last 180 days after a meetup was confirmed (scheduledAt),
//                    except "they didn't show up" (the person left waiting shouldn't pay for it)
//   upheldReports  = moderation decisions against them (listing removed, warned, banned), counting
//                    reports resolved together as one
//   ageDays        = days since they signed up
//   bayes = (3 × 4.0 + avg × count) / (3 + count)   → a single 5★ review doesn't make anyone perfect
//   score = 50 + min(completedDeals, 20) × 1.5 + (bayes − 3.5) × 8 + min(ageDays / 30, 6)
//              − cancellations × 3 − upheldReports × 15, rounded and kept within 0..100
// Runs after something that's already saved (a deal, a review), so it logs instead of throwing.
export const recomputeTrust = async (userId) => {
    try {
        const me = toObjectId(userId);
        const since = new Date(Date.now() - CANCELLATION_WINDOW_DAYS * DAY_MS);

        const [user, { counterparts }, [ratings], cancellations, [upheld]] = await Promise.all([
            User.findById(me).select("createdAt").lean(),
            dealStats(me),
            Review.aggregate([
                { $match: { reviewee: me } },
                { $sort: { createdAt: -1 } },
                { $group: { _id: "$reviewer", rating: { $first: "$rating" } } },
                { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } }
            ]),
            Deal.countDocuments({
                $or: [{ buyer: me }, { seller: me }],
                status: DEAL_STATUS.CANCELLED,
                cancelledBy: me,
                cancelledAt: { $gte: since },
                scheduledAt: { $ne: null },
                cancelReason: { $ne: "no_show" }
            }),
            Report.aggregate([
                { $match: { user: me, status: REPORT_STATUS.RESOLVED, action: { $in: UPHELD_REPORT_ACTIONS } } },
                { $group: { _id: { targetType: "$targetType", listing: "$listing", message: "$message", action: "$action" } } },
                { $count: "n" }
            ])
        ]);
        if (!user) return null;

        const avg = ratings?.avg ?? 0;
        const count = ratings?.count ?? 0;
        const ageDays = (Date.now() - user.createdAt.getTime()) / DAY_MS;
        const bayes = (3 * 4.0 + avg * count) / (3 + count);
        const score = 50
            + Math.min(counterparts, 20) * 1.5
            + (bayes - 3.5) * 8
            + Math.min(ageDays / 30, 6)
            - cancellations * 3
            - (upheld?.n ?? 0) * 15;

        const trust = {
            score: Math.round(Math.min(100, Math.max(0, score))),
            completedDeals: counterparts,
            ratingAvg: Math.round(avg * 100) / 100,
            ratingCount: count,
            cancellations
        };
        await User.updateOne({ _id: me }, { $set: { trust } });
        return trust;
    } catch (err) {
        console.error("⚠️ Couldn't recompute a trust score:", err.message);
        return null;
    }
};

const progress = (current, target) => ({ current: Math.min(current, target), target });

// Profile badges. `stats` = dealStats() plus { isVerified, ratingAvg, ratingCount } from the user.
// Badges that count towards a goal carry `progress: { current, target }`.
export const computeBadges = (stats) => [
    {
        id: "verified",
        label: "Verified student",
        description: "Joined with a college email",
        earned: Boolean(stats.isVerified)
    },
    {
        id: "first_deal",
        label: "First deal",
        description: "Completed a first deal on CampusSwap",
        earned: stats.completedDeals >= 1,
        progress: progress(stats.completedDeals, 1)
    },
    {
        id: "trusted_seller",
        label: "Trusted seller",
        description: "5 sales to different people, rated 4.5★ or more",
        earned: stats.sales >= 5 && stats.ratingAvg >= 4.5,
        progress: progress(stats.sales, 5)
    },
    {
        id: "top_rated",
        label: "Top rated",
        description: "Rated 4.8★ or more by at least 3 people",
        earned: stats.ratingCount >= 3 && stats.ratingAvg >= 4.8,
        progress: progress(stats.ratingCount, 3)
    },
    {
        id: "generous",
        label: "Generous",
        description: "Gave away 3 items for free",
        earned: stats.freeGiven >= 3,
        progress: progress(stats.freeGiven, 3)
    },
    {
        id: "swap_master",
        label: "Swap master",
        description: "Completed 3 swaps",
        earned: stats.swaps >= 3,
        progress: progress(stats.swaps, 3)
    },
    {
        id: "eco_warrior",
        label: "Eco warrior",
        description: "Gave 10 items a second life (as buyer or seller)",
        earned: stats.completedDeals >= 10,
        progress: progress(stats.completedDeals, 10)
    }
];
