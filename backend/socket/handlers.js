import Conversation from "../models/conversation.model.js";
import User from "../models/user.model.js";
import { blockedIdsFor, isBlockedPair } from "../utils/blocks.js";
import { isOnline, presenceRoom, userRoom } from "./presence.js";

// Events the browser sends: typing, presence:watch and presence:unwatch.

const MINUTE = 60 * 1000;
const TYPING_INTERVAL_MS = 2000; // at most one "typing" per chat every 2 s
const WATCH_CALLS_PER_MINUTE = 10;
const MAX_WATCH_IDS = 50; // per presence:watch call
const MAX_WATCHED_USERS = 200; // per socket, in total
const MAX_CACHED_CHATS = 100;
const STRIKES_PER_MINUTE = 30; // dropped or invalid events before the socket is disconnected

const toObjectIdString = (value) => (typeof value === "string" && /^[a-f\d]{24}$/i.test(value) ? value.toLowerCase() : null);

const idList = (payload) => (Array.isArray(payload?.userIds) ? payload.userIds.map(toObjectIdString).filter(Boolean) : []);

// Handlers run outside Express, so an unexpected error would otherwise be an unhandled rejection.
const safe = (handler) => async (...args) => {
    try {
        await handler(...args);
    } catch (err) {
        console.error("⚠️ Socket event failed:", err.message);
    }
};

// A well-behaved client never hits the limits. One that keeps ignoring them is disconnected.
const strike = (socket) => {
    const now = Date.now();
    const strikes = socket.data.strikes;
    if (now - strikes.since > MINUTE) Object.assign(strikes, { since: now, count: 0 });
    strikes.count += 1;
    if (strikes.count > STRIKES_PER_MINUTE) socket.disconnect(true);
};

// The other person in a chat, or null if this user isn't in it (or either blocked the other).
// Cached per socket so typing doesn't query the database every time; forgetConversation() clears it.
const peerOf = async (socket, conversationId) => {
    const cache = socket.data.conversations;
    if (cache.has(conversationId)) return cache.get(conversationId);

    const { userId } = socket.data;
    const conversation = await Conversation.findOne({ _id: conversationId, participants: userId }).select("participants").lean();
    const otherId = conversation?.participants.map(String).find((id) => id !== userId) ?? null;
    const peer = otherId && !(await isBlockedPair(userId, otherId)) ? otherId : null;

    if (cache.size >= MAX_CACHED_CHATS) cache.delete(cache.keys().next().value);
    cache.set(conversationId, peer);
    return peer;
};

// typing { conversationId, isTyping } → the other person gets typing { conversationId, userId, isTyping }.
const onTyping = (socket) => safe(async (payload) => {
    const conversationId = toObjectIdString(payload?.conversationId);
    if (!conversationId) return strike(socket);

    const peerId = await peerOf(socket, conversationId);
    if (!peerId) return strike(socket);

    const isTyping = payload.isTyping === true;
    const last = socket.data.typing.get(conversationId) ?? { at: 0, isTyping: false };
    const now = Date.now();

    if (isTyping) {
        if (now - last.at < TYPING_INTERVAL_MS) return strike(socket);
        socket.data.typing.set(conversationId, { at: now, isTyping: true });
    } else {
        // "Stopped typing" is only worth relaying after a "typing" went out.
        if (!last.isTyping) return;
        socket.data.typing.set(conversationId, { at: last.at, isTyping: false });
    }

    socket.to(userRoom(peerId)).emit("typing", { conversationId, userId: socket.data.userId, isTyping });
});

// presence:watch ({ userIds }, ack) → ack({ online: [ids], lastSeen: { [id]: date | null } }), then live
// presence:update events for those users. Only same-campus users with no block either way are
// included; anyone else is silently left out, so this can't be used to track people.
const onPresenceWatch = (socket) => safe(async (payload, ack) => {
    const reply = typeof ack === "function" ? ack : () => {};
    const now = Date.now();

    socket.data.watchCalls = socket.data.watchCalls.filter((at) => now - at < MINUTE);
    if (socket.data.watchCalls.length >= WATCH_CALLS_PER_MINUTE) {
        strike(socket);
        return reply({ online: [], lastSeen: {}, error: "Too many presence requests. Try again in a minute." });
    }
    socket.data.watchCalls.push(now);

    const { userId, campus, watching } = socket.data;
    const blocked = new Set((await blockedIdsFor(userId)).map(String));
    const ids = [...new Set(idList(payload))].filter((id) => id !== userId && !blocked.has(id)).slice(0, MAX_WATCH_IDS);
    const users = await User.find({ _id: { $in: ids }, campus }).select("lastSeenAt").lean();

    const online = [];
    const lastSeen = {};
    for (const user of users) {
        const id = String(user._id);
        if (!watching.has(id)) {
            if (watching.size >= MAX_WATCHED_USERS) continue;
            watching.add(id);
            socket.join(presenceRoom(id));
        }
        if (isOnline(id)) online.push(id);
        lastSeen[id] = user.lastSeenAt ?? null;
    }

    reply({ online, lastSeen });
});

// presence:unwatch { userIds }: stop receiving presence:update for them.
const onPresenceUnwatch = (socket) => safe(async (payload) => {
    for (const id of idList(payload)) {
        if (socket.data.watching.delete(id)) socket.leave(presenceRoom(id));
    }
});

export const registerHandlers = (socket) => {
    Object.assign(socket.data, {
        conversations: new Map(), // conversationId → the other participant's id (or null)
        typing: new Map(), // conversationId → when "typing" was last relayed
        watching: new Set(), // user ids whose presence this socket follows
        watchCalls: [],
        strikes: { since: 0, count: 0 }
    });

    socket.on("typing", onTyping(socket));
    socket.on("presence:watch", onPresenceWatch(socket));
    socket.on("presence:unwatch", onPresenceUnwatch(socket));
};
