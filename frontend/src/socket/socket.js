import { io } from "socket.io-client";
import api from "../api/axios";

// Development: the page's own origin, which Vite proxies to Express (vite.config.js). Production: the
// API's own URL in VITE_SOCKET_URL, because Vercel can proxy /api requests but not WebSockets.
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;
const MISCONFIGURED = import.meta.env.PROD && !import.meta.env.VITE_SOCKET_URL;

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  withCredentials: true,
  // WebSocket first. If it can't open (some campus proxies and firewalls block it), long-polling takes
  // over in the same attempt: socket.io only moves on to the next transport with tryAllTransports.
  transports: ["websocket", "polling"],
  tryAllTransports: true,
  // The socket server never reads the session cookie. Every connection attempt (reconnects too)
  // first asks the API for a fresh 2-minute socket token.
  auth: (callback) =>
    api
      .get("/auth/socket-token")
      .then((res) => callback({ token: res.data.token }))
      .catch(() => callback({})),
});

// A WebSocket that just hangs (rather than failing) never gets to that fallback: the attempt times out
// and the next one would try WebSocket again, forever. So after a timeout, connections start with
// long-polling, which still switches to WebSocket by itself wherever that works.
socket.on("connect_error", (error) => {
  if (error.message === "timeout") socket.io.opts.transports = ["polling", "websocket"];
});

export const connectSocket = () => {
  if (MISCONFIGURED) {
    console.error("CampusSwap: VITE_SOCKET_URL is not set, so live chat is off. Set it to the API's URL and rebuild.");
    return;
  }
  // `active` is true while connected or reconnecting; connecting twice would send a second handshake.
  if (!socket.active) socket.connect();
};

export const disconnectSocket = () => {
  socket.disconnect();
  forgetPresence();
  typingSentAt.clear();
  typingActive.clear();
};

// ── Typing ────────────────────────────────────────────────
// The server relays at most one "typing" per chat every 2 s and counts extras against the connection,
// so one goes out at most every 3 s per chat, and "stopped" only after a "typing" went out. Nothing is
// sent while disconnected: socket.io would queue it and deliver it, stale, after a reconnect.

const TYPING_EVERY_MS = 3000;
const typingSentAt = new Map(); // conversationId → when "typing" last went out
const typingActive = new Set(); // chats where the other person currently sees "typing…"

export const sendTyping = (conversationId, isTyping) => {
  if (!socket.connected) return;
  if (isTyping) {
    const now = Date.now();
    if (now - (typingSentAt.get(conversationId) ?? 0) < TYPING_EVERY_MS) return;
    typingSentAt.set(conversationId, now);
    typingActive.add(conversationId);
  } else if (!typingActive.delete(conversationId)) {
    return;
  }
  socket.emit("typing", { conversationId, isTyping });
};

// ── Presence ──────────────────────────────────────────────
// Components ask to follow someone's online status with watchPresence(ids). Requests are batched
// (the server allows 10 presence:watch calls a minute, 50 ids each) and repeated after every
// reconnect, because the server forgets what a socket watched when it disconnects.

const BATCH_SIZE = 50;
const MAX_WATCHED = 200;
const watched = new Set();
let queued = new Set();
let flushTimer = null;
let pausedUntil = 0;
let onSnapshot = () => {};

// SocketManager stores the replies ({ online: [ids], lastSeen: { id: date } }) in Redux.
export const setPresenceHandler = (handler) => {
  onSnapshot = handler;
};

const scheduleFlush = (delay) => {
  if (!flushTimer) flushTimer = setTimeout(flush, delay);
};

function flush() {
  flushTimer = null;
  // While disconnected nothing is sent: the "connect" handler below queues everything again.
  if (!socket.connected || queued.size === 0) return;
  const wait = pausedUntil - Date.now();
  if (wait > 0) return scheduleFlush(wait);

  const ids = [...queued].slice(0, BATCH_SIZE);
  ids.forEach((id) => queued.delete(id));
  socket.emit("presence:watch", { userIds: ids }, (reply) => {
    if (reply?.error) {
      // Over the server's limit: back off, then ask again.
      ids.forEach((id) => queued.add(id));
      pausedUntil = Date.now() + 30000;
      scheduleFlush(30000);
      return;
    }
    onSnapshot(reply);
  });
  if (queued.size > 0) scheduleFlush(1000);
}

export const watchPresence = (userIds) => {
  for (const id of userIds) {
    if (!id || watched.has(id) || watched.size >= MAX_WATCHED) continue;
    watched.add(id);
    queued.add(id);
  }
  if (queued.size > 0) scheduleFlush(250);
};

socket.on("connect", () => {
  queued = new Set(watched);
  clearTimeout(flushTimer);
  flushTimer = null;
  if (queued.size > 0) scheduleFlush(250);
});

function forgetPresence() {
  watched.clear();
  queued.clear();
  clearTimeout(flushTimer);
  flushTimer = null;
  pausedUntil = 0;
}
