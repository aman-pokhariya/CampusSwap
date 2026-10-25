// Creates or updates the campuses in seed/campuses.data.js. Safe to run again: it never deletes users.
// Usage: npm run seed
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import Campus from "../models/campus.model.js";
import "../models/user.model.js";
import "../models/otp.model.js";
import campuses from "../seed/campuses.data.js";

await connectDB();

for (const data of campuses) {
    const campus = await Campus.findOneAndUpdate({ slug: data.slug }, data, {
        upsert: true,
        returnDocument: "after",
        runValidators: true
    });
    console.log(`🏫 ${campus.name} — ${campus.hostels.length} hostels, ${campus.safeSpots.length} safe spots, emails: @${campus.emailDomains.join(", @")}`);
}

// Build indexes now (unique email, TTL for OTP codes, ...) instead of on first use.
await mongoose.connection.syncIndexes();

console.log(`\n✅ Seeded ${campuses.length} campuses.`);
await mongoose.disconnect();
