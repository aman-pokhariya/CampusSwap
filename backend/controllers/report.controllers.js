import mongoose from "mongoose";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import Report from "../models/report.model.js";
import User from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import { sameId } from "../utils/ids.js";
import { findListing } from "../utils/listingAccess.js";
import { autoFlagIfReported, countsTowardFlag } from "../utils/reports.js";

// What a report points at, once we know the reporter can see it. Anything they can't see is a 404,
// so reports can't be used to probe ids on other campuses or in other people's chats.
// `user` is always the person the report is about.
const TARGETS = {
    // Same campus, not hidden (findListing), and not my own.
    listing: async (id, me) => {
        const listing = await findListing(id, me);
        if (listing.seller.equals(me._id)) throw new ApiError(400, "You can't report your own listing", { code: "OWN_LISTING" });
        return { fields: { listing: listing._id, user: listing.seller }, listing };
    },

    // A verified student on my campus who isn't me.
    user: async (id, me) => {
        if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "User not found");
        if (sameId(id, me._id)) throw new ApiError(400, "You can't report yourself", { code: "SELF_REPORT" });

        const user = await User.findById(id).select("campus isVerified").lean();
        if (!user || !user.isVerified || !sameId(user.campus, me.campus)) throw new ApiError(404, "User not found");
        return { fields: { user: user._id } };
    },

    // A message in one of my chats that the other person sent.
    message: async (id, me) => {
        if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Message not found");

        const message = await Message.findById(id).select("conversation sender").lean();
        const inMyChat = message && (await Conversation.exists({ _id: message.conversation, participants: me._id }));
        if (!inMyChat) throw new ApiError(404, "Message not found");
        if (!message.sender || sameId(message.sender, me._id)) {
            throw new ApiError(400, "You can only report messages the other person sent", { code: "INVALID_TARGET" });
        }
        return { fields: { message: message._id, user: message.sender } };
    }
};

// The answer is the same whatever happens next, and nobody is ever told who reported them.
export const createReport = async (req, res) => {
    const { targetType, targetId, reason, details } = req.body;
    const me = req.user;
    const { fields, listing } = await TARGETS[targetType](targetId, me);

    let report;
    try {
        report = await Report.create({
            reporter: me._id,
            targetType,
            ...fields,
            campus: me.campus,
            reason,
            details,
            countsTowardFlag: countsTowardFlag(me)
        });
    } catch (err) {
        // The partial unique index: this person already has an open report about it.
        if (err.code === 11000) throw new ApiError(409, "You've already reported this — we'll take a look.", { code: "ALREADY_REPORTED" });
        throw err;
    }
    await User.updateOne({ _id: me._id }, { $inc: { "reportStats.filed": 1 } });

    // The report is saved either way: if the auto-flag check fails, an admin still sees the report.
    if (listing && report.countsTowardFlag) {
        await autoFlagIfReported(listing).catch((err) => console.error("⚠️ Auto-flag check failed:", err.message));
    }

    return res.status(201).json({
        success: true,
        message: "Thanks — we'll take a look.",
        report: { _id: report._id, targetType: report.targetType, reason: report.reason, status: report.status, createdAt: report.createdAt }
    });
};
