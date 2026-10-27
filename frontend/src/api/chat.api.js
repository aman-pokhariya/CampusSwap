import { baseApi } from "./baseApi";
import api from "./axios";
import { messageFailed, queueMessage, removeQueuedMessage, setTyping, setUnread } from "../redux/chatSlice";
import { isFromOther, previewOf } from "../utils/chat";
import { getErrorData, getErrorMessage } from "../utils/errors";

const INBOX = { type: "Conversations", id: "LIST" };
const DEAL_LIST = { type: "Deals", id: "LIST" };

// Refusals that mean "the chat changed since this tab loaded it" (403 not your turn / blocked, 409 conflict).
const STALE_STATUSES = [403, 409];
const CLOSED_CHAT_CODES = ["CHAT_CLOSED", "BLOCKED"];

const toTime = (date) => new Date(date ?? 0).getTime();

// Chats move up as messages arrive, so a page of the inbox ends at its oldest chat, not simply its last one.
const oldestActivity = (conversations) =>
  conversations.reduce(
    (oldest, conversation) => (toTime(conversation.lastMessageAt) < toTime(oldest) ? conversation.lastMessageAt : oldest),
    conversations[0].lastMessageAt,
  );

// Photos waiting to be sent, by clientId: { file, url } (url = the local preview). Files can't live in
// Redux (they aren't serializable) and must stay around until delivery, so "Retry" can send them again.
const outgoingPhotos = new Map();

export const stashOutgoingPhoto = (clientId, photo) => outgoingPhotos.set(clientId, photo);

// Logging out forgets every photo that was still waiting.
export const forgetOutgoingPhotos = () => {
  outgoingPhotos.forEach(({ url }) => URL.revokeObjectURL(url));
  outgoingPhotos.clear();
};

// Sends in one chat go out one at a time, in the order they were written, so a photo that is still
// uploading can't be saved (and shown to both people) after a text typed below it.
const sendQueues = new Map(); // conversationId → the latest send in that chat

// The latest messages and offer changes put into each loaded chat (live, or from my own sends). A
// fetch of that chat that was already on its way (a reconnect's refetch, older messages loading)
// answers with what the server had before them and replaces the cached pages, so they're put back
// once it lands (getMessages below). Putting one back twice changes nothing.
const LIVE_KEEP = 50;
const liveMessages = new Map(); // conversationId → Map(messageId → message)
const liveOffers = new Map(); // conversationId → Map(offerId → offer)

const remember = (store, conversationId, id, value) => {
  const entries = store.get(conversationId) ?? new Map();
  entries.delete(id); // a newer copy goes to the end
  entries.set(id, value);
  if (entries.size > LIVE_KEEP) entries.delete(entries.keys().next().value);
  store.set(conversationId, entries);
};

// Logging out forgets them too.
export const forgetLiveChanges = () => {
  liveMessages.clear();
  liveOffers.clear();
};

// When the last unread:update arrived: a badge fetch that started before it has older numbers.
let unreadUpdatedAt = 0;

export const chatApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // Newest activity first. `before` pages are cursors on lastMessageAt. A refetch (after a
    // reconnect, say) only reloads the newest page: that's the only one news can change, and older
    // pages load again as the list scrolls.
    getConversations: build.infiniteQuery({
      infiniteQueryOptions: {
        initialPageParam: null,
        getNextPageParam: (lastPage) =>
          lastPage.hasMore && lastPage.conversations.length > 0 ? oldestActivity(lastPage.conversations) : undefined,
        refetchCachedPages: false,
      },
      query: ({ queryArg, pageParam }) => ({
        url: "/conversations",
        params: { listing: queryArg?.listing, before: pageParam ?? undefined, limit: 30 },
      }),
      providesTags: [INBOX],
    }),

    getConversation: build.query({
      query: (id) => ({ url: `/conversations/${id}` }),
      providesTags: (result, error, id) => [{ type: "Conversations", id }],
    }),

    // The Chats and Deals badges. Live changes arrive as unread:update (socket/SocketManager.jsx).
    getUnreadCounts: build.query({
      query: () => ({ url: "/conversations/unread-count" }),
      providesTags: [
        { type: "Conversations", id: "UNREAD" },
        { type: "Deals", id: "UNREAD" },
      ],
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        const startedAt = Date.now();
        try {
          const { data } = await queryFulfilled;
          // An unread:update that came in meanwhile is newer than this answer: it stays.
          if (unreadUpdatedAt < startedAt) dispatch(setUnread({ chats: data.chats, deals: data.deals }));
        } catch {
          // The badges keep their last value.
        }
      },
    }),

    // Each page is oldest → newest. "Next" pages go back in time: everything before the oldest message
    // loaded. A refetch reloads every page that was loaded, so offer cards further up are fresh too.
    getMessages: build.infiniteQuery({
      infiniteQueryOptions: {
        initialPageParam: null,
        getNextPageParam: (lastPage) =>
          lastPage.hasMore && lastPage.messages.length > 0 ? lastPage.messages[0].createdAt : undefined,
      },
      query: ({ queryArg: conversationId, pageParam }) => ({
        url: `/conversations/${conversationId}/messages`,
        params: { before: pageParam ?? undefined, limit: 30 },
      }),
      providesTags: (result, error, conversationId) => [{ type: "Messages", id: conversationId }],
      async onQueryStarted(conversationId, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(restoreLiveChanges(conversationId));
        } catch {
          // Nothing was replaced.
        }
      },
    }),

    // "Message seller": finds the chat about this listing, or starts it.
    startConversation: build.mutation({
      query: (listingId) => ({ url: "/conversations", method: "POST", data: { listingId } }),
      async onQueryStarted(listingId, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          // The chat opens instantly with what we just got; the inbox picks a new chat up when shown.
          dispatch(chatApi.util.upsertQueryData("getConversation", data.conversation._id, { conversation: data.conversation }));
          dispatch(chatApi.util.invalidateTags([INBOX]));
        } catch {
          // The caller shows the error.
        }
      },
    }),

    // Sending a message is sendChatMessage below, not an endpoint here.

    // Cheap to call often: the server does nothing when the chat is already read.
    markRead: build.mutation({
      query: (conversationId) => ({ url: `/conversations/${conversationId}/read`, method: "POST" }),
      onQueryStarted(conversationId, { dispatch }) {
        dispatch(clearUnread(conversationId));
      },
    }),

    makeOffer: build.mutation({
      query: ({ conversationId, ...body }) => ({ url: `/conversations/${conversationId}/offers`, method: "POST", data: body }),
      async onQueryStarted({ conversationId }, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(addMessage(conversationId, data.message));
          dispatch(applyOffer(conversationId, data.offer));
        } catch (err) {
          // The dialog shows the error. A refusal means this tab's copy of the chat is out of date (say
          // the listing expired, or there's an offer already): reload it so the buttons match reality.
          if (STALE_STATUSES.includes(err.error?.status)) {
            dispatch(chatApi.util.invalidateTags([{ type: "Conversations", id: conversationId }, { type: "Messages", id: conversationId }]));
          }
        }
      },
    }),

    // { offerId, conversationId, action: "accept" | "counter" | "decline" | "withdraw", amount?, periods?, note? }
    respondToOffer: build.mutation({
      query: ({ offerId, conversationId, ...body }) => ({ url: `/offers/${offerId}/respond`, method: "POST", data: body }),
      async onQueryStarted({ conversationId }, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(applyOffer(conversationId, data.offer));
          // Accepting reserves the listing and creates a deal: the chat, the listing and deal lists change.
          if (data.deal) {
            dispatch(
              chatApi.util.invalidateTags([
                { type: "Conversations", id: conversationId },
                { type: "Listing", id: data.offer.listing },
                "MyListings",
                DEAL_LIST,
              ]),
            );
          }
        } catch (err) {
          // Someone else changed the offer first (409), or it isn't my move any more (403): reload the
          // chat so the card shows what happened.
          if (STALE_STATUSES.includes(err.error?.status)) {
            dispatch(chatApi.util.invalidateTags([{ type: "Messages", id: conversationId }, { type: "Conversations", id: conversationId }]));
          }
        }
      },
    }),

    // Newest first, 20 at a time. Every page also carries the current unread count. A refetch only
    // reloads the newest page (like the inbox).
    getNotifications: build.infiniteQuery({
      infiniteQueryOptions: {
        initialPageParam: null,
        getNextPageParam: (lastPage) =>
          lastPage.hasMore && lastPage.notifications.length > 0 ? lastPage.notifications.at(-1).createdAt : undefined,
        refetchCachedPages: false,
      },
      query: ({ pageParam }) => ({ url: "/notifications", params: { before: pageParam ?? undefined, limit: 20 } }),
      providesTags: ["Notifications"],
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(setUnread({ notifications: data.pages.at(-1).unreadCount }));
        } catch {
          // The bell keeps its last count.
        }
      },
    }),

    // Both read actions update the bell at once and roll back if the request fails.
    markNotificationRead: build.mutation({
      query: (id) => ({ url: `/notifications/${id}/read`, method: "PATCH" }),
      async onQueryStarted(id, { dispatch, getState, queryFulfilled }) {
        const before = getState().chat.unread.notifications;
        const { patches, changed } = dispatch(markNotificationsRead((notification) => notification._id === id));
        dispatch(setUnread({ notifications: before - changed }));
        try {
          const { data } = await queryFulfilled;
          dispatch(setUnread({ notifications: data.unreadCount }));
        } catch {
          patches.forEach((patch) => patch.undo());
          dispatch(setUnread({ notifications: before }));
        }
      },
    }),

    markAllNotificationsRead: build.mutation({
      query: () => ({ url: "/notifications/read-all", method: "POST" }),
      async onQueryStarted(arg, { dispatch, getState, queryFulfilled }) {
        const before = getState().chat.unread.notifications;
        const { patches } = dispatch(markNotificationsRead(() => true));
        dispatch(setUnread({ notifications: 0 }));
        try {
          await queryFulfilled;
        } catch {
          patches.forEach((patch) => patch.undo());
          dispatch(setUnread({ notifications: before }));
        }
      },
    }),
  }),
});

export const {
  useGetConversationsInfiniteQuery,
  useGetConversationQuery,
  useGetUnreadCountsQuery,
  useGetMessagesInfiniteQuery,
  useStartConversationMutation,
  useMarkReadMutation,
  useMakeOfferMutation,
  useRespondToOfferMutation,
  useGetNotificationsInfiniteQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} = chatApi;

// ── Cache updates ─────────────────────────────────────────
// Shared by the socket events (socket/SocketManager.jsx) and the mutations above, so a change
// looks the same whether it came back as a response or arrived live. All of them are idempotent.

const { selectCachedArgsForQuery, updateQueryData, invalidateTags } = chatApi.util;

// A fetch that was still on its way when a live change was patched in lands afterwards, with what the
// server had before the change, and replaces the patched copy. So that query is fetched once more:
// invalidating waits for running requests to settle first.
const isFetching = (state, endpoint, arg) => chatApi.endpoints[endpoint].select(arg)(state).status === "pending";

// Runs `recipe` on every cached copy of every conversation: the inbox lists (with the list's query
// arg) and each chat's own query. `recipe` returns true when it changed the conversation.
const forEachCachedConversation = (dispatch, state, recipe) => {
  const refetch = [];
  for (const arg of selectCachedArgsForQuery(state, "getConversations")) {
    dispatch(
      updateQueryData("getConversations", arg, (draft) =>
        draft.pages.forEach((page) => page.conversations.forEach((conversation) => recipe(conversation, "list", arg))),
      ),
    );
    // The list being fetched may bring back the chat this change was about, as it was before.
    if (isFetching(state, "getConversations", arg)) refetch.push(INBOX);
  }
  for (const id of selectCachedArgsForQuery(state, "getConversation")) {
    let changed = false;
    dispatch(
      updateQueryData("getConversation", id, (draft) => {
        if (draft.conversation) changed = recipe(draft.conversation, "chat") || changed;
      }),
    );
    // A chat still loading for the first time has nothing to patch yet, so it may be this one.
    const entry = chatApi.endpoints.getConversation.select(id)(state);
    if (entry.status === "pending" && (changed || !entry.data)) refetch.push({ type: "Conversations", id });
  }
  if (refetch.length > 0) dispatch(invalidateTags(refetch));
};

// Same, for one conversation. Returns whether every cached inbox list that should show it already has
// it: the full inbox, plus a "chats about this listing" list for its listing. A chat in an older page
// that isn't loaded, or one this tab has never seen, means a list needs reloading.
const patchConversation = (dispatch, state, conversationId, recipe) => {
  let found = false;
  let listingId = null;
  const listsWithIt = new Set();
  forEachCachedConversation(dispatch, state, (conversation, where, arg) => {
    if (conversation._id !== conversationId) return false;
    found = true;
    listingId = conversation.listing._id;
    if (where === "list") listsWithIt.add(arg);
    recipe(conversation);
    return true;
  });
  return (
    found &&
    selectCachedArgsForQuery(state, "getConversations")
      .filter((arg) => !arg?.listing || arg.listing === listingId)
      .every((arg) => listsWithIt.has(arg))
  );
};

// Runs `recipe` on a chat's loaded messages. Returns whether they're loaded (or loading) at all.
const patchMessages = (dispatch, state, conversationId, recipe) => {
  if (!selectCachedArgsForQuery(state, "getMessages").includes(conversationId)) return false;
  dispatch(updateQueryData("getMessages", conversationId, recipe));
  return true;
};

// Puts a message into the newest page, once, in time order.
const insertMessage = (message) => (draft) => {
  const newest = draft.pages[0];
  if (!newest || draft.pages.some((page) => page.messages.some((m) => m._id === message._id))) return;
  const before = newest.messages.findLastIndex((m) => toTime(m.createdAt) <= toTime(message.createdAt));
  newest.messages.splice(before + 1, 0, message);
};

// Every card of this offer shows its newest state (a newer one is never overwritten by an older one).
const isNewerOffer = (offer, current) => !current || toTime(offer.updatedAt) >= toTime(current.updatedAt);
const updateOfferCards = (offer) => (draft) => {
  for (const page of draft.pages) {
    for (const message of page.messages) {
      if (message.offer?._id === offer._id && isNewerOffer(offer, message.offer)) message.offer = offer;
    }
  }
};

// A fetch of a chat's messages has landed: what was put in while it was on its way goes back in.
// Only messages inside the stretch of the chat that's loaded: an older one (after a long time
// offline, say) comes back with its own page, and putting it in the newest page would make "load
// older" skip everything between them.
const restoreLiveChanges = (conversationId) => (dispatch) => {
  const messages = [...(liveMessages.get(conversationId)?.values() ?? [])];
  const offers = [...(liveOffers.get(conversationId)?.values() ?? [])];
  if (messages.length === 0 && offers.length === 0) return;
  dispatch(
    updateQueryData("getMessages", conversationId, (draft) => {
      const oldestPage = draft.pages.at(-1);
      const loadedFrom = toTime(oldestPage?.messages[0]?.createdAt);
      messages
        .filter((message) => !oldestPage?.hasMore || toTime(message.createdAt) >= loadedFrom)
        .forEach((message) => insertMessage(message)(draft));
      offers.forEach((offer) => updateOfferCards(offer)(draft));
    }),
  );
};

// The conversation as this tab knows it (for a toast's name), or null.
export const selectCachedConversation = (state, conversationId) => {
  const chat = chatApi.endpoints.getConversation.select(conversationId)(state).data?.conversation;
  if (chat) return chat;
  for (const arg of selectCachedArgsForQuery(state, "getConversations")) {
    const pages = chatApi.endpoints.getConversations.select(arg)(state).data?.pages ?? [];
    const found = pages.flatMap((page) => page.conversations).find((conversation) => conversation._id === conversationId);
    if (found) return found;
  }
  return null;
};

// Puts a message into its chat (once, in time order) and moves the chat's inbox preview forward.
// `latest` is the server's { lastMessage, lastMessageAt } when it came with the event. Returns
// whether every cached inbox list that should show the chat has it (see patchConversation).
export const addMessage =
  (conversationId, message, { latest, countUnread = false } = {}) =>
  (dispatch, getState) => {
    const state = getState();
    if (patchMessages(dispatch, state, conversationId, insertMessage(message))) {
      remember(liveMessages, conversationId, message._id, message);
    }

    const { lastMessage, lastMessageAt } = latest ?? { lastMessage: previewOf(message), lastMessageAt: message.createdAt };
    return patchConversation(dispatch, state, conversationId, (conversation) => {
      // The preview only ever moves forward in time.
      if (toTime(lastMessageAt) >= toTime(conversation.lastMessageAt)) {
        conversation.lastMessage = lastMessage;
        conversation.lastMessageAt = lastMessageAt;
      }
      if (countUnread) conversation.unreadCount += 1;
    });
  };

// Ids of the latest messages that arrived live, so one delivered twice can never count twice.
const recentlyReceived = new Set();
const RECENT_LIMIT = 300;

// message:new. Every tab of both people gets it, the sender's own tabs too.
export const receiveMessage =
  ({ conversationId, message, conversation, clientId }) =>
  (dispatch, getState) => {
    if (clientId) dispatch(dropQueuedMessage(conversationId, clientId));
    if (recentlyReceived.has(message._id)) return;
    recentlyReceived.add(message._id);
    if (recentlyReceived.size > RECENT_LIMIT) recentlyReceived.delete(recentlyReceived.values().next().value);

    const state = getState();
    const fromOther = isFromOther(message, state.auth.user?._id);
    const onScreen = state.chat.activeConversationId === conversationId && document.visibilityState === "visible";

    const inInbox = dispatch(addMessage(conversationId, message, { latest: conversation, countUnread: fromOther && !onScreen }));
    if (fromOther && message.type !== "system") dispatch(setTyping({ conversationId, isTyping: false }));

    // A list is missing this chat (someone's first message to me, or a chat in a page not loaded yet):
    // reload the inbox so it shows up at the top.
    if (!inInbox && selectCachedArgsForQuery(state, "getConversations").length > 0) dispatch(invalidateTags([INBOX]));
  };

// The server has the message (or the user discarded a failed one): drop the outbox copy and its photo.
export const dropQueuedMessage = (conversationId, clientId) => (dispatch, getState) => {
  const queued = getState().chat.outbox[conversationId]?.some((message) => message.clientId === clientId);
  const photo = outgoingPhotos.get(clientId);
  if (photo) {
    URL.revokeObjectURL(photo.url);
    outgoingPhotos.delete(clientId);
  }
  if (queued) dispatch(removeQueuedMessage({ conversationId, clientId }));
};

// ── Sending ───────────────────────────────────────────────
// Text goes as JSON, a photo as multipart with its caption. The bubble shows at once from the outbox
// (redux/chatSlice.js) and is swapped for the server's copy once saved; a failed one offers Retry, which
// sends it again with the same clientId. Plain axios, not an RTK Query mutation: a photo can take up to
// two minutes, and while any RTK request is running every tag invalidation in the app waits for it
// (RTK's default "delayed" invalidation), e.g. the inbox showing a new chat.

// The POST for a message in the outbox, built when it's queued (so it keeps its photo).
const messageRequest = ({ conversationId, clientId, text }) => {
  const url = `/conversations/${conversationId}/messages`;
  const photo = outgoingPhotos.get(clientId);
  if (!photo) return () => api.post(url, { text, clientId });

  const form = new FormData();
  form.append("image", photo.file, photo.file.name);
  form.append("text", text);
  form.append("clientId", clientId);
  return () => api.post(url, form, { timeout: 120000 });
};

// Never rejects, so a failed send doesn't stop the ones queued after it.
const deliver = async (dispatch, { conversationId, clientId }, post) => {
  try {
    const { data } = await post();
    dispatch(addMessage(conversationId, data.message));
    dispatch(dropQueuedMessage(conversationId, clientId));
  } catch (error) {
    // The chat closed (listing deleted or removed, or a block): no Retry, and reload the chat so its
    // notice replaces the composer.
    const closed = CLOSED_CHAT_CODES.includes(getErrorData(error).code);
    if (closed) dispatch(invalidateTags([{ type: "Conversations", id: conversationId }]));
    dispatch(messageFailed({ conversationId, clientId, error: getErrorMessage(error, "Couldn't send"), retryable: !closed }));
  }
};

// { conversationId, clientId, text, imageUrl } (imageUrl: the photo's local preview, for the bubble).
// Waits for the chat's earlier sends; Retry joins the end of the queue.
export const sendChatMessage = (message) => (dispatch) => {
  const { conversationId, clientId, text, imageUrl } = message;
  dispatch(queueMessage({ conversationId, clientId, text, imageUrl }));
  const post = messageRequest(message);
  const run = (sendQueues.get(conversationId) ?? Promise.resolve()).then(() => deliver(dispatch, message, post));
  sendQueues.set(conversationId, run);
  run.then(() => {
    if (sendQueues.get(conversationId) === run) sendQueues.delete(conversationId);
  });
  return run;
};

// offer:update, and the responses to our own offer actions. A newer state never gets overwritten by an
// older one (a response and an event can arrive in either order).
export const applyOffer = (conversationId, offer) => (dispatch, getState) => {
  const state = getState();

  if (patchMessages(dispatch, state, conversationId, updateOfferCards(offer))) {
    remember(liveOffers, conversationId, offer._id, offer);
  }
  patchConversation(dispatch, state, conversationId, (conversation) => {
    const current = conversation.activeOffer;
    if (offer.status === "pending") {
      if (current?._id !== offer._id || isNewerOffer(offer, current)) conversation.activeOffer = offer;
    } else if (current?._id === offer._id && isNewerOffer(offer, current)) {
      conversation.activeOffer = null;
    }
    if (offer.status === "accepted" && offer.deal && conversation.deal?._id !== offer.deal) {
      conversation.deal = { _id: offer.deal, status: "agreed" };
    }
  });
};

// Clears a chat's badge straight away when it's opened (markRead tells the server).
const clearUnread = (conversationId) => (dispatch, getState) => {
  let cleared = 0;
  patchConversation(dispatch, getState(), conversationId, (conversation) => {
    cleared = Math.max(cleared, conversation.unreadCount);
    conversation.unreadCount = 0;
  });
  if (cleared > 0) dispatch(setUnread({ chats: getState().chat.unread.chats - cleared }));
};

// conversation:read. The other person read the chat ("Seen"), or another tab of mine did (clear the badge).
export const applyRead = ({ conversationId, userId, readAt }) => (dispatch, getState) => {
  const me = getState().auth.user?._id;
  patchConversation(dispatch, getState(), conversationId, (conversation) => {
    if (userId === me) conversation.unreadCount = 0;
    else if (toTime(readAt) > toTime(conversation.otherLastReadAt)) conversation.otherLastReadAt = readAt;
  });
};

// listing:update: a listing people are chatting about was reserved, sold, put back, relisted or deleted.
export const applyListingChange = ({ listingId, status, deleted, hidden }) => (dispatch, getState) => {
  const affected = new Set();
  forEachCachedConversation(dispatch, getState(), (conversation) => {
    if (conversation.listing._id !== listingId) return false;
    Object.assign(conversation.listing, { status, deleted, hidden });
    affected.add(conversation._id);
    return true;
  });

  // "hidden" can mean under review (chat stays open) or removed (chat closed): open chats reload to find out.
  const chats = hidden ? [...affected].map((id) => ({ type: "Conversations", id })) : [];
  dispatch(invalidateTags([{ type: "Listing", id: listingId }, "MyListings", ...chats]));
};

// A deal changed (deal:update, or the answer to one of my deal actions): the chats it came from show
// its new status in their deal chip. The deal's own caches live in api/deals.api.js.
export const setChatDealStatus = (dealId, status) => (dispatch, getState) => {
  forEachCachedConversation(dispatch, getState(), (conversation) => {
    if (conversation.deal?._id !== dealId || conversation.deal.status === status) return false;
    conversation.deal.status = status;
    return true;
  });
};

// Marks the cached notifications that `match` as read. Returns the undo patches and how many were unread.
const markNotificationsRead = (match) => (dispatch, getState) => {
  const unreadIds = new Set();
  const patches = selectCachedArgsForQuery(getState(), "getNotifications").map((arg) =>
    dispatch(
      updateQueryData("getNotifications", arg, (draft) => {
        for (const page of draft.pages) {
          for (const notification of page.notifications) {
            if (notification.read || !match(notification)) continue;
            notification.read = true;
            unreadIds.add(notification._id);
          }
        }
      }),
    ),
  );
  return { patches, changed: unreadIds.size };
};

// notification:new. A repeat of an unread notification keeps its id and moves back to the top.
export const receiveNotification = ({ notification, unreadCount }) => (dispatch, getState) => {
  const state = getState();
  dispatch(setUnread({ notifications: unreadCount }));
  let refetch = false;
  for (const arg of selectCachedArgsForQuery(state, "getNotifications")) {
    dispatch(
      updateQueryData("getNotifications", arg, (draft) => {
        draft.pages.forEach((page) => {
          page.notifications = page.notifications.filter((n) => n._id !== notification._id);
        });
        draft.pages[0]?.notifications.unshift(notification);
      }),
    );
    refetch ||= isFetching(state, "getNotifications", arg); // see isFetching
  }
  if (refetch) dispatch(invalidateTags(["Notifications"]));
};

// unread:update { chats, deals }: the server's own count, newer than any fetch still on its way.
export const receiveUnreadCounts = (counts) => (dispatch) => {
  unreadUpdatedAt = Date.now();
  dispatch(setUnread(counts));
};
