import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useStore } from "react-redux";
import { toast } from "sonner";
import { connectSocket, disconnectSocket, setPresenceHandler, socket } from "./socket";
import { baseApi } from "../api/baseApi";
import {
  applyListingChange,
  applyOffer,
  applyRead,
  chatApi,
  forgetLiveChanges,
  forgetOutgoingPhotos,
  receiveMessage,
  receiveNotification,
  receiveUnreadCounts,
  selectCachedConversation,
  useGetUnreadCountsQuery,
} from "../api/chat.api";
import { applyDealChange } from "../api/deals.api";
import { clearCurrentUser } from "../redux/authSlice";
import { presenceChanged, presenceSnapshot, resetChat, setConnected, setTyping } from "../redux/chatSlice";
import { chatToastId } from "../utils/chat";
import { dealIdOfLink, dealToastId } from "../utils/deals";
import { announceSession } from "../utils/sessionSync";

// "typing…" disappears this long after the last typing event, in case the "stopped" one never comes.
const TYPING_TIMEOUT_MS = 6000;

// A deal change comes as a notification (the server's own words) and then as deal:update. The update
// only shows its own toast when no notification about that deal came just before it.
const DEAL_TOAST_GAP_MS = 10000;

const SESSION_ENDED_COPY = {
  banned: "Your account has been suspended.",
  account_deleted: "This account no longer exists.",
};

const short = (text, max = 80) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

// "/inbox/<id>" → "<id>", so a notification about a chat shares that chat's toast.
const chatIdOf = (link) => link?.match(/^\/inbox\/([^/?#]+)/)?.[1] ?? null;

// Lives in AppLayout, so it runs exactly while someone is logged in: opens the real-time connection
// and turns every server event into a cache update, a badge or a toast. Renders nothing.
export default function SocketManager() {
  const dispatch = useDispatch();
  const store = useStore();
  const navigate = useNavigate();

  // Keeps the Chats and Deals badges loaded (they're refetched after every reconnect).
  useGetUnreadCountsQuery();

  // navigate changes on every route change, and the effect below must not reconnect each time.
  const navigateRef = useRef(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  });

  useEffect(() => {
    let sessionEnded = false;
    let retryTimer = null;
    let failedHandshakes = 0;
    const typingTimers = new Map();
    const dealToastAt = new Map(); // dealId → when a toast about it last showed
    const open = (link) => navigateRef.current(link);

    const stopTyping = (conversationId) => {
      clearTimeout(typingTimers.get(conversationId));
      typingTimers.delete(conversationId);
      dispatch(setTyping({ conversationId, isTyping: false }));
    };

    // A rejected handshake (no or expired token) is never retried by socket.io itself.
    const retryLater = () => {
      clearTimeout(retryTimer);
      retryTimer = setTimeout(connectSocket, Math.min(60000, 2000 * 2 ** failedHandshakes));
      failedHandshakes += 1;
    };

    const handlers = {
      connect: () => {
        failedHandshakes = 0;
        dispatch(setConnected(true));
        // Events sent before this connection existed never arrive: while we were away, and on the
        // first connect too (pages load over HTTP while the socket is still getting its token). So
        // what's on screen is fetched again, once any request already running settles. That stays
        // cheap and safe: only queries in use, only the newest page of each list, and live changes
        // that come in meanwhile are kept (api/chat.api.js).
        dispatch(baseApi.util.invalidateTags(["Conversations", "Messages", "Notifications", "Deals"]));
      },

      disconnect: (reason) => {
        dispatch(setConnected(false));
        [...typingTimers.keys()].forEach(stopTyping);
        // Dropped by the server (not a ban): socket.io won't reconnect on its own, so we do, a bit later.
        if (reason === "io server disconnect" && !sessionEnded) retryLater();
      },

      connect_error: () => {
        if (!socket.active) retryLater();
      },

      "message:new": async (payload) => {
        dispatch(receiveMessage(payload));

        const { conversationId, message } = payload;
        const isChatMessage = message.type === "text" || message.type === "image";
        // No toast for my own messages, or for the chat that's on screen (checked again after the fetch).
        const wanted = () => {
          const state = store.getState();
          return Boolean(state.auth.user) && message.sender !== state.auth.user._id && state.chat.activeConversationId !== conversationId;
        };
        if (!isChatMessage || !wanted()) return;

        // Someone's first message to me: this tab doesn't have the chat yet, so fetch it for their name.
        let name = selectCachedConversation(store.getState(), conversationId)?.otherUser.name;
        if (!name) {
          name = await dispatch(chatApi.endpoints.getConversation.initiate(conversationId, { subscribe: false }))
            .unwrap()
            .then(({ conversation }) => conversation.otherUser.name)
            .catch(() => null);
          if (!wanted()) return;
        }

        // Same id for every message in a chat: a burst of messages updates one toast.
        toast(name ?? "New message", {
          id: chatToastId(conversationId),
          description: message.type === "image" ? `📷 ${message.text || "Photo"}` : short(message.text),
          action: { label: "Open", onClick: () => open(`/inbox/${conversationId}`) },
        });
      },

      "conversation:read": (payload) => dispatch(applyRead(payload)),

      "offer:update": ({ conversationId, offer }) => dispatch(applyOffer(conversationId, offer)),

      // Every cached copy of the deal follows it. A toast when the other person did something (and
      // that deal's page isn't the one on screen, which shows the change itself).
      "deal:update": (payload) => {
        const news = dispatch(applyDealChange(payload));
        const { dealId } = payload;
        const toastedJustNow = Date.now() - (dealToastAt.get(dealId) ?? 0) < DEAL_TOAST_GAP_MS;
        if (!news || toastedJustNow || store.getState().chat.activeDealId === dealId) return;

        dealToastAt.set(dealId, Date.now());
        toast(news.title, {
          id: dealToastId(dealId),
          description: news.description,
          action: { label: "View", onClick: () => open(`/deals/${dealId}`) },
        });
      },

      "listing:update": (payload) => dispatch(applyListingChange(payload)),

      "notification:new": (payload) => {
        dispatch(receiveNotification(payload));

        // No toast for news about the chat or deal that's already open: it shows there anyway. News
        // about another chat (or deal) replaces its toast instead of stacking a second one.
        const { notification } = payload;
        const { activeConversationId, activeDealId } = store.getState().chat;
        const chatId = chatIdOf(notification.link);
        const dealId = dealIdOfLink(notification.link);
        if ((chatId && chatId === activeConversationId) || (dealId && dealId === activeDealId)) return;

        if (dealId) dealToastAt.set(dealId, Date.now());
        toast(notification.title, {
          id: chatId ? chatToastId(chatId) : dealId ? dealToastId(dealId) : undefined,
          description: notification.body ? short(notification.body, 120) : undefined,
          action: notification.link ? { label: "View", onClick: () => open(notification.link) } : undefined,
        });
      },

      "unread:update": (counts) => dispatch(receiveUnreadCounts(counts)),

      "presence:update": (payload) => dispatch(presenceChanged(payload)),

      typing: ({ conversationId, isTyping }) => {
        if (!isTyping) return stopTyping(conversationId);
        clearTimeout(typingTimers.get(conversationId));
        typingTimers.set(conversationId, setTimeout(() => stopTyping(conversationId), TYPING_TIMEOUT_MS));
        dispatch(setTyping({ conversationId, isTyping: true }));
      },

      // The server ended this session (e.g. the account was suspended): same as losing the session.
      "session:ended": ({ reason }) => {
        sessionEnded = true;
        dispatch(clearCurrentUser());
        dispatch(baseApi.util.resetApiState());
        dispatch(resetChat());
        announceSession(null);
        toast.error(SESSION_ENDED_COPY[reason] ?? "You've been signed out. Please log in again.");
      },
    };

    setPresenceHandler((reply) => dispatch(presenceSnapshot(reply)));
    Object.entries(handlers).forEach(([event, handler]) => socket.on(event, handler));
    // Connecting on the next tick: in development, StrictMode mounts, unmounts and mounts this again
    // straight away, and the cleanup in between would close a WebSocket that is still connecting (a
    // console warning). The first timer is cleared before it fires. In production this runs once.
    const connectTimer = setTimeout(connectSocket, 0);

    return () => {
      Object.entries(handlers).forEach(([event, handler]) => socket.off(event, handler));
      clearTimeout(connectTimer);
      clearTimeout(retryTimer);
      typingTimers.forEach((timer) => clearTimeout(timer));
      disconnectSocket();
      forgetOutgoingPhotos();
      forgetLiveChanges();
      dispatch(setConnected(false));
    };
  }, [dispatch, store]);

  return null;
}
