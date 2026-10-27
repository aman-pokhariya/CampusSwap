// Creates or updates the campuses in seed/campuses.data.js and fills in fields that older documents
// are missing. Safe to run again: it never deletes users.
// Usage: npm run seed
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import Campus from "../models/campus.model.js";
import User from "../models/user.model.js";
import Listing from "../models/listing.model.js";
// Imported so syncIndexes() below builds their indexes too.
import "../models/otp.model.js";
import "../models/save.model.js";
import "../models/listingView.model.js";
import "../models/conversation.model.js";
import "../models/message.model.js";
import "../models/offer.model.js";
import "../models/deal.model.js";
import "../models/notification.model.js";
import "../models/review.model.js";
import Report from "../models/report.model.js";
import "../models/block.model.js";
import campuses from "../seed/campuses.data.js";
import { DEFAULT_TRUST, MODERATION_STATE } from "../config/constants.js";

await connectDB();

for (const data of campuses) {
    const campus = await Campus.findOneAndUpdate({ slug: data.slug }, data, {
        upsert: true,
        returnDocument: "after",
        runValidators: true
    });
    console.log(`🏫 ${campus.name} — ${campus.hostels.length} hostels, ${campus.safeSpots.length} safe spots, emails: @${campus.emailDomains.join(", @")}`);
}

// Backfill: documents created before these fields existed. Lean reads don't apply schema defaults,
// so without this an old listing would have no moderation state and an old user no trust score
// (or report history, which weighs their reports).
const listings = await Listing.updateMany({ moderation: { $exists: false } }, { $set: { moderation: { state: MODERATION_STATE.OK } } });
const users = await User.updateMany({ trust: { $exists: false } }, { $set: { trust: { ...DEFAULT_TRUST } } });
const reporters = await User.updateMany({ reportStats: { $exists: false } }, { $set: { reportStats: { filed: 0, dismissed: 0 } } });
// Reports filed before they stored a campus take the campus of the person they're about (the admin queue filters on it).
const oldReports = (await Report.find({ campus: { $exists: false } }).select("user").populate("user", "campus").lean())
    .filter((report) => report.user?.campus);
await Promise.all(oldReports.map((report) => Report.updateOne({ _id: report._id }, { $set: { campus: report.user.campus } })));
console.log(
    `🧹 Backfilled moderation on ${listings.modifiedCount} listings, trust on ${users.modifiedCount} users, ` +
    `report stats on ${reporters.modifiedCount} users and the campus on ${oldReports.length} reports.`
);

// Build every index now (unique email, OTP and view TTLs, the 2dsphere index the feed needs,
// one pending offer per chat, one open deal per listing, one open report per reporter and target,
// one block per pair, ...) so a fresh database is fully ready before the first request.
await mongoose.connection.syncIndexes();

console.log(`\n✅ Seeded ${campuses.length} campuses.`);
await mongoose.disconnect();
