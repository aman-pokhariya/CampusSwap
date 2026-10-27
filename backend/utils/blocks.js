import Block from "../models/block.model.js";
import { idOf } from "./ids.js";

// Every block check (chat, offers, deals, presence, notifications, lists) goes through these helpers.

// Either user has blocked the other.
export const isBlockedPair = async (userA, userB) => {
    if (!userA || !userB) return false;
    return Boolean(
        await Block.exists({
            $or: [
                { blocker: userA, blocked: userB },
                { blocker: userB, blocked: userA }
            ]
        })
    );
};

// `blockerId` has blocked `blockedId` (one direction only, e.g. "don't notify me about them").
export const hasBlocked = async (blockerId, blockedId) =>
    Boolean(blockerId && blockedId && (await Block.exists({ blocker: blockerId, blocked: blockedId })));

// Everyone this user blocked or was blocked by (ObjectIds), for leaving them out of lists in one query.
export const blockedIdsFor = async (userId) => {
    const rows = await Block.find({ $or: [{ blocker: userId }, { blocked: userId }] }).select("blocker blocked").lean();
    const others = new Map(
        rows.map(({ blocker, blocked }) => (idOf(blocker) === idOf(userId) ? blocked : blocker)).map((id) => [idOf(id), id])
    );
    return [...others.values()];
};
