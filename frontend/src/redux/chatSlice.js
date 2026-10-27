import { createSlice } from "@reduxjs/toolkit";

// Live chat state that isn't a server response: who is typing, who is online, which chat (or deal
// page) is open, the badge counts, and messages still on their way to the server. Cleared on logout
// (resetChat).
const initialState = {
  connected: false,
  typing: {}, // conversationId → true while the other person types
  presence: {}, // userId → { online, lastSeenAt }
  activeConversationId: null,
  activeDealId: null, // the deal page on screen: its news needs no toast
  unread: { chats: 0, deals: 0, notifications: 0 },
  // conversationId → [{ clientId, text, image, createdAt, status: "sending" | "failed", error, retryable }]
  // Kept out of the RTK Query cache so a refetch can never wipe a message that hasn't been sent yet.
  // `retryable: false` when the chat itself refused it (closed or blocked): Retry would fail again.
  outbox: {},
};

const findOutgoing = (state, conversationId, clientId) =>
  state.outbox[conversationId]?.find((message) => message.clientId === clientId);

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    setConnected: (state, action) => {
      state.connected = action.payload;
    },
    setTyping: (state, action) => {
      const { conversationId, isTyping } = action.payload;
      if (isTyping) state.typing[conversationId] = true;
      else delete state.typing[conversationId];
    },
    // The reply to presence:watch: a snapshot for every user it covers.
    presenceSnapshot: (state, action) => {
      const { online = [], lastSeen = {} } = action.payload;
      for (const [userId, lastSeenAt] of Object.entries(lastSeen)) {
        state.presence[userId] = { online: online.includes(userId), lastSeenAt };
      }
    },
    presenceChanged: (state, action) => {
      const { userId, online, lastSeenAt } = action.payload;
      state.presence[userId] = { online, lastSeenAt: lastSeenAt ?? state.presence[userId]?.lastSeenAt ?? null };
    },
    setActiveConversation: (state, action) => {
      state.activeConversationId = action.payload;
    },
    setActiveDeal: (state, action) => {
      state.activeDealId = action.payload;
    },
    // Partial updates: { chats, deals } from unread:update, { notifications } from the bell.
    setUnread: (state, action) => {
      for (const [key, value] of Object.entries(action.payload)) {
        if (typeof value === "number") state.unread[key] = Math.max(0, value);
      }
    },
    // Adds a message to the outbox, or flips a failed one back to "sending" (Retry).
    queueMessage: {
      reducer: (state, action) => {
        const { conversationId, clientId, text, imageUrl, createdAt } = action.payload;
        const existing = findOutgoing(state, conversationId, clientId);
        if (existing) {
          existing.status = "sending";
          existing.error = null;
          return;
        }
        (state.outbox[conversationId] ??= []).push({
          clientId,
          text,
          image: imageUrl ? { url: imageUrl } : null,
          createdAt,
          status: "sending",
          error: null,
        });
      },
      // The timestamp is taken here, so the reducer itself stays pure.
      prepare: (payload) => ({ payload: { ...payload, createdAt: new Date().toISOString() } }),
    },
    messageFailed: (state, action) => {
      const { conversationId, clientId, error, retryable = true } = action.payload;
      const message = findOutgoing(state, conversationId, clientId);
      if (message) Object.assign(message, { status: "failed", error, retryable });
    },
    // Delivered (the server's copy is in the cache now) or discarded by the user.
    removeQueuedMessage: (state, action) => {
      const { conversationId, clientId } = action.payload;
      const queue = state.outbox[conversationId];
      if (!queue) return;
      state.outbox[conversationId] = queue.filter((message) => message.clientId !== clientId);
      if (state.outbox[conversationId].length === 0) delete state.outbox[conversationId];
    },
    resetChat: () => initialState,
  },
});

export const {
  setConnected,
  setTyping,
  presenceSnapshot,
  presenceChanged,
  setActiveConversation,
  setActiveDeal,
  setUnread,
  queueMessage,
  messageFailed,
  removeQueuedMessage,
  resetChat,
} = chatSlice.actions;
export default chatSlice.reducer;
