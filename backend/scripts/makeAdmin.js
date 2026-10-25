// Gives an existing account the admin role.
// Usage: npm run make-admin -- you@college.edu
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import User from "../models/user.model.js";
import { ROLES } from "../config/constants.js";

const email = process.argv[2]?.trim().toLowerCase();

if (!email) {
    console.error("Usage: npm run make-admin -- you@college.edu");
    process.exit(1);
}

await connectDB();

const user = await User.findOneAndUpdate({ email }, { role: ROLES.ADMIN }, { returnDocument: "after" });

if (user) {
    console.log(`✅ ${user.name} (${user.email}) is now an admin. Refresh the app to see it.`);
} else {
    console.error(`❌ No account found for ${email}. Sign up first, then run this again.`);
    process.exitCode = 1;
}

await mongoose.disconnect();
