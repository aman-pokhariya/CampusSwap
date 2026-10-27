import mongoose from "mongoose";
import { REPORT_ACTIONS, REPORT_REASONS, REPORT_SOURCES, REPORT_STATUS, REPORT_TARGETS } from "../config/constants.js";

const { ObjectId } = mongoose.Schema.Types;

// A report about a listing, a user or a chat message, for the admins' queue (Chunk 6).
// The reported person is never told who reported them.
const reportSchema = new mongoose.Schema(
    {
        // null when the system filed it (AI or keyword moderation).
        reporter: {
            type: ObjectId,
            ref: "User",
            default: null
        },

        targetType: {
            type: String,
            enum: REPORT_TARGETS,
            required: true
        },

        listing: {
            type: ObjectId,
            ref: "Listing"
        },

        // Whoever the report is about: the reported user, the listing's owner or the message's sender.
        // That makes "reports against this person" (trust score, admin view) a single query.
        user: {
            type: ObjectId,
            ref: "User"
        },

        message: {
            type: ObjectId,
            ref: "Message"
        },

        // Reports never cross campuses, so this is the reporter's campus and the reported person's too.
        // The admin queue is filtered on it.
        campus: {
            type: ObjectId,
            ref: "Campus"
        },

        reason: {
            type: String,
            enum: REPORT_REASONS,
            required: true
        },

        details: {
            type: String,
            trim: true,
            maxlength: 1000,
            default: ""
        },

        source: {
            type: String,
            enum: REPORT_SOURCES,
            default: "user"
        },

        status: {
            type: String,
            enum: Object.values(REPORT_STATUS),
            default: REPORT_STATUS.OPEN
        },

        // What the admin did about it (Chunk 6).
        action: {
            type: String,
            enum: REPORT_ACTIONS,
            default: "none"
        },
        note: {
            type: String,
            trim: true,
            maxlength: 500
        },
        resolvedBy: {
            type: ObjectId,
            ref: "User"
        },
        resolvedAt: Date,

        // Decided when the report is filed (utils/reports.js): only reports from established, verified
        // accounts with a good reporting record can hide a listing automatically.
        countsTowardFlag: {
            type: Boolean,
            default: false
        }
    },
    { timestamps: true }
);

// Whoever files a report without saying the campus (a seed script, the AI check in Chunk 5) gets the
// campus of the person it's about, so it still shows up in that campus's admin queue.
reportSchema.pre("validate", async function () {
    if (this.campus || !this.user) return;
    const user = await mongoose.model("User").findById(this.user).select("campus").lean();
    this.campus = user?.campus;
});

// One open report per person per target: reporting the same thing twice is a 409, not a second vote.
reportSchema.index(
    { reporter: 1, targetType: 1, listing: 1, user: 1, message: 1 },
    { unique: true, partialFilterExpression: { status: REPORT_STATUS.OPEN } }
);
// The admin queue: one campus, or every campus for global admins.
reportSchema.index({ campus: 1, status: 1, createdAt: -1 });
reportSchema.index({ status: 1, createdAt: -1 });
// "How many different students reported this listing?" (auto-flag).
reportSchema.index({ listing: 1, status: 1, reporter: 1 });
reportSchema.index({ user: 1, status: 1 });

const Report = mongoose.model("Report", reportSchema);

export default Report;
