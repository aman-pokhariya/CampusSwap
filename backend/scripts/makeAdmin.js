// Gives an existing account the admin role: for their own campus, or with --global for every campus.
// Usage: npm run make-admin -- you@college.edu [--global]
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import User from "../models/user.model.js";
import { ADMIN_SCOPE, ROLES } from "../config/constants.js";

const args = process.argv.slice(2);
const email = args.find((arg) => !arg.startsWith("--"))?.trim().toLowerCase();
const adminScope = args.includes("--global") ? ADMIN_SCOPE.GLOBAL : ADMIN_SCOPE.CAMPUS;

if (!email) {
    console.error("Usage: npm run make-admin -- you@college.edu [--global]");
    process.exit(1);
}

await connectDB();

const user = await User.findOneAndUpdate({ email }, { role: ROLES.ADMIN, adminScope }, { returnDocument: "after" });

if (user) {
    const scope = adminScope === ADMIN_SCOPE.GLOBAL ? "every campus" : "their own campus";
    console.log(`✅ ${user.name} (${user.email}) is now an admin of ${scope}. Refresh the app to see it.`);
} else {
    console.error(`❌ No account found for ${email}. Sign up first, then run this again.`);
    process.exitCode = 1;
}

await mongoose.disconnect();
