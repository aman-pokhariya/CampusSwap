import mongoose from "mongoose";
import Block from "../models/block.model.js";
import Conversation from "../models/conversation.model.js";
import User from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import { sameId } from "../utils/ids.js";
import { toPublicUser } from "../utils/publicUser.js";
import { cancelOffersBetween, firstName } from "../utils/offers.js";
import { forgetConversation } from "../socket/index.js";
import { PUBLIC_USER_FIELDS } from "../config/constants.js";

// People I blocked, newest first (Settings → Blocked users).
export const getMyBlocks = async (req, res) => {
    const { limit } = req.validatedQuery;

    const rows = await Block.find({ blocker: req.user._id })
        .sort({ createdAt: -1 })
        .limit(limit + 1)
        .populate("blocked", PUBLIC_USER_FIELDS)
        .lean();
    const blocks = rows
        .slice(0, limit)
        .filter((row) => row.blocked)
        .map((row) => ({ user: toPublicUser(row.blocked), blockedAt: row.createdAt }));

    return res.json({ success: true, blocks, hasMore: rows.length > limit });
};

// Only someone on my own campus (nobody else can reach me here), and never myself.
const findBlockTarget = async (id, me) => {
    if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "User not found");
    if (sameId(id, me._id)) throw new ApiError(400, "You can't block yourself", { code: "SELF_BLOCK" });

    const user = await User.findById(id).select("name campus isVerified").lean();
    if (!user || !user.isVerified || !sameId(user.campus, me.campus)) throw new ApiError(404, "User not found");
    return user;
};

// Both people's open tabs drop what they cached about every chat between the two (who's typing,
// whose presence they follow), so the block (or unblock) applies straight away. Returns the chats.
const forgetChatsBetween = async (userA, userB) => {
    const conversations = await Conversation.find({ participants: { $all: [userA, userB] } }).select("owner visitor").lean();
    await Promise.all(conversations.flatMap(({ _id }) => [forgetConversation(userA, _id), forgetConversation(userB, _id)]));
    return conversations;
};

// From now on neither can message the other, make or answer offers, or plan meetups, and neither sees
// the other's listings in lists. Open deals can still be cancelled or completed in person.
// Idempotent: blocking twice changes nothing. The rest runs again anyway, which also finishes the
// work of an earlier request that stopped halfway.
export const blockUser = async (req, res) => {
    const me = req.user;
    const target = await findBlockTarget(req.params.id, me);

    // The block row first: every check from here on (chat, offers, meetups) already sees it.
    try {
        await Block.create({ blocker: me._id, blocked: target._id });
    } catch (err) {
        if (err.code !== 11000) throw err;
    }

    const conversations = await forgetChatsBetween(me._id, target._id);
    await cancelOffersBetween(conversations, { blockedId: target._id });

    return res.json({ success: true, message: `${firstName(target.name)} is blocked`, blocked: true });
};

// Unblocking only removes the block: offers it cancelled stay cancelled.
export const unblockUser = async (req, res) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "User not found");

    const removed = await Block.findOneAndDelete({ blocker: req.user._id, blocked: id }).lean();
    if (removed) await forgetChatsBetween(req.user._id, removed.blocked);

    return res.json({ success: true, message: "Unblocked", blocked: false });
};
