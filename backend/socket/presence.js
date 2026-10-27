// Who is online right now: userId → ids of their open sockets (one per tab or device).
// Kept in memory, which is fine for a single server instance.
const onlineUsers = new Map();

// Every socket of a user joins their room, so "send to Riya" reaches all of Riya's tabs.
export const userRoom = (userId) => `user:${userId}`;

// Sockets watching a user's online status join this room (see presence:watch in handlers.js).
export const presenceRoom = (userId) => `presence:${userId}`;

export const isOnline = (userId) => onlineUsers.has(String(userId));

export const socketIdsOf = (userId) => [...(onlineUsers.get(String(userId)) ?? [])];

export const onlineUserIds = () => [...onlineUsers.keys()];

// Returns true when this is the user's first open socket (they just came online).
export const addSocket = (userId, socketId) => {
    const sockets = onlineUsers.get(userId) ?? new Set();
    sockets.add(socketId);
    onlineUsers.set(userId, sockets);
    return sockets.size === 1;
};

// Returns true when that was the user's last open socket (they just went offline).
export const removeSocket = (userId, socketId) => {
    const sockets = onlineUsers.get(userId);
    if (!sockets) return false;
    sockets.delete(socketId);
    if (sockets.size > 0) return false;
    onlineUsers.delete(userId);
    return true;
};
