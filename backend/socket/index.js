import { Server } from "socket.io";
import Conversation from "../models/conversation.model.js";
import User from "../models/user.model.js";
import { isAllowedOrigin } from "../config/env.js";
import { verifySocketToken } from "../utils/socketToken.js";
import { idOf } from "../utils/ids.js";
import { registerHandlers } from "./handlers.js";
import { addSocket, onlineUserIds, presenceRoom, removeSocket, socketIdsOf, userRoom } from "./presence.js";

export { isOnline } from "./presence.js";

const SESSION_RECHECK_MS = 5 * 60 * 1000;

// null until initSocket() runs (index.js). Every helper below is a no-op without it, so
// controllers can emit freely when app.js is used on its own (tests).
let io = null;

const socketsOf = (userId) => (io ? socketIdsOf(userId).map((id) => io.sockets.sockets.get(id)).filter(Boolean) : []);

// No Origin header = not a browser (curl, tests). Browsers must come from our frontend.
const allowOrigin = (origin) => !origin || isAllowedOrigin(origin);

const unauthorized = () => Object.assign(new Error("Not authorized"), { data: { code: "SOCKET_UNAUTHORIZED" } });

// Only the 2-minute socket token from GET /api/auth/socket-token opens a socket. The session cookie
// is never accepted here, so another site can't open a socket with someone's cookie.
const authenticate = async (socket, next) => {
    try {
        const { userId, iat } = verifySocketToken(socket.handshake.auth?.token);
        const user = await User.findById(userId).select("campus isVerified isBanned passwordChangedAt");
        if (!user || !user.isVerified || user.isBanned || user.changedPasswordAfter(iat)) return next(unauthorized());

        Object.assign(socket.data, { userId: String(user._id), campus: String(user.campus), tokenIssuedAt: iat });
        next();
    } catch {
        // Missing, expired, tampered or wrong-audience token (or the database is unreachable).
        // socket.io middleware isn't Express: errors have to be passed to next() by hand.
        next(unauthorized());
    }
};

const endSession = (socket, reason) => {
    socket.emit("session:ended", { reason });
    socket.disconnect(true); // a server-side disconnect: the client won't try to reconnect
};

const setLastSeen = (userId, at) =>
    User.updateOne({ _id: userId }, { lastSeenAt: at }).catch((err) => console.error("⚠️ Couldn't save lastSeenAt:", err.message));

const onConnection = (socket) => {
    const { userId } = socket.data;
    socket.join(userRoom(userId));
    registerHandlers(socket);

    // Only the first tab coming online (and the last one leaving) changes anyone's presence.
    if (addSocket(userId, socket.id)) {
        setLastSeen(userId, new Date());
        io.to(presenceRoom(userId)).emit("presence:update", { userId, online: true });
    }

    socket.on("disconnect", () => {
        if (!removeSocket(userId, socket.id)) return;
        const lastSeenAt = new Date();
        setLastSeen(userId, lastSeenAt);
        io.to(presenceRoom(userId)).emit("presence:update", { userId, online: false, lastSeenAt });
    });
};

// Bans and password changes disconnect sockets straight away (disconnectUser). This is the safety
// net for anything that slipped past: every 5 minutes each connected user is checked again.
const recheckSessions = async () => {
    const ids = onlineUserIds();
    if (ids.length === 0) return;

    const users = await User.find({ _id: { $in: ids } }).select("isBanned passwordChangedAt").lean();
    const byId = new Map(users.map((user) => [String(user._id), user]));

    for (const socket of io.sockets.sockets.values()) {
        const user = byId.get(socket.data.userId);
        if (!user || user.isBanned) {
            endSession(socket, user ? "banned" : "account_deleted");
        } else if (user.passwordChangedAt?.getTime() > socket.data.tokenIssuedAt * 1000) {
            socket.conn.close();
        }
    }
};

export const initSocket = (httpServer) => {
    io = new Server(httpServer, {
        // CORS doesn't cover WebSocket upgrades, so engine.io checks the Origin of every new connection itself.
        allowRequest: (req, callback) => callback(null, allowOrigin(req.headers.origin)),
        cors: { origin: (origin, callback) => callback(null, allowOrigin(origin)), credentials: true },
        serveClient: false,
        // Browsers only send small events (typing, a list of user ids).
        maxHttpBufferSize: 16 * 1024
    });

    io.use(authenticate);
    io.on("connection", onConnection);

    setInterval(() => {
        recheckSessions().catch((err) => console.error("⚠️ Socket session check failed:", err.message));
    }, SESSION_RECHECK_MS).unref();

    return io;
};

export const emitToUser = (userId, event, payload) => {
    io?.to(userRoom(idOf(userId))).emit(event, payload);
};

export const emitToUsers = (userIds, event, payload) => {
    const rooms = [...new Set(userIds.map(idOf).filter(Boolean))].map(userRoom);
    if (io && rooms.length > 0) io.to(rooms).emit(event, payload);
};

// Ends a user's live connections. notify: true (bans) first tells every tab that the session is over.
// Without it (password changes) only the connection drops: the current tab reconnects with a fresh
// token, while devices that were logged out can't get one and the HTTP interceptor logs them out.
export const disconnectUser = (userId, { notify = false, reason = "signed_out" } = {}) => {
    for (const socket of socketsOf(idOf(userId))) {
        if (notify) endSession(socket, reason);
        else socket.conn.close();
    }
};

// After a block (or unblock): this user's sockets forget the chat (the next typing event checks
// again) and stop following the other person's presence.
export const forgetConversation = async (userId, conversationId) => {
    const sockets = socketsOf(idOf(userId));
    if (sockets.length === 0) return;

    const key = idOf(conversationId);
    try {
        let otherId = sockets.map((socket) => socket.data.conversations.get(key)).find(Boolean);
        if (!otherId) {
            const conversation = await Conversation.findById(key).select("participants").lean();
            otherId = conversation?.participants.map(String).find((id) => id !== idOf(userId));
        }

        for (const socket of sockets) {
            socket.data.conversations.delete(key);
            socket.data.typing.delete(key);
            if (otherId && socket.data.watching.delete(otherId)) socket.leave(presenceRoom(otherId));
        }
    } catch (err) {
        console.error("⚠️ Couldn't forget a conversation on its sockets:", err.message);
    }
};
