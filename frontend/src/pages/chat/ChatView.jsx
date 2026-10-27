import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import { ArrowLeft, Ban, Lock, RefreshCw, SearchX } from "lucide-react";
import ChatHeader from "../../components/chat/ChatHeader";
import DealBanner from "../../components/chat/DealBanner";
import ActiveOfferBar from "../../components/chat/ActiveOfferBar";
import MessageList from "../../components/chat/MessageList";
import Composer from "../../components/chat/Composer";
import OfferDialog from "../../components/chat/OfferDialog";
import EmptyState from "../../components/ui/EmptyState";
import Skeleton from "../../components/ui/Skeleton";
import { buttonClasses } from "../../components/ui/Button";
import {
  dropQueuedMessage,
  sendChatMessage,
  useGetConversationQuery,
  useGetMessagesInfiniteQuery,
  useMarkReadMutation,
} from "../../api/chat.api";
import { useGetBlocksQuery, useUnblockUserMutation } from "../../api/trust.api";
import { setActiveConversation } from "../../redux/chatSlice";
import { useGoBack } from "../../hooks/useGoBack";
import { canMakeOffer, chatClosedReason, chatToastId, isFromOther, offerStatus } from "../../utils/chat";
import { firstName } from "../../utils/deals";

const NO_MESSAGES = [];

// Phones: a full-screen layer above the tab bar. It's a flex column as tall as the visible viewport
// (h-dvh; with interactive-widget=resizes-content in index.html the keyboard shrinks it), so the
// composer is simply the column's last row, never hidden behind the keyboard. Wide screens: the
// right-hand pane of the inbox.
const SHELL = "fixed inset-x-0 top-0 z-50 flex h-dvh flex-col bg-slate-50 md:static md:z-auto md:h-full dark:bg-slate-950";

function MessagesSkeleton() {
  return (
    <div className="flex flex-1 flex-col justify-end gap-3 p-4" aria-hidden>
      <Skeleton className="h-10 w-2/5 rounded-2xl" />
      <Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" />
      <Skeleton className="h-16 w-3/5 rounded-2xl" />
      <Skeleton className="ml-auto h-10 w-1/3 rounded-2xl" />
    </div>
  );
}

// Phones only: wide screens keep the list next to the chat.
function BackButton({ onBack }) {
  return (
    <button
      type="button"
      onClick={onBack}
      aria-label="Back to chats"
      className="grid size-10 shrink-0 place-items-center rounded-xl text-slate-600 hover:bg-slate-100 md:hidden dark:text-slate-300 dark:hover:bg-slate-800"
    >
      <ArrowLeft className="size-5" />
    </button>
  );
}

function BackOnlyHeader({ onBack }) {
  return (
    <div className="flex h-14 items-center border-b border-slate-200 bg-white px-2 md:hidden dark:border-slate-800 dark:bg-slate-900">
      <BackButton onBack={onBack} />
    </div>
  );
}

const NOTICE = "border-t border-slate-200 bg-white px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400";

// In place of the composer once either person blocked the other. Only the one who blocked hears
// about it (with a way to undo it); the other person just can't reply any more.
function BlockedNotice({ user, blockedByMe }) {
  const [unblockUser, { isLoading }] = useUnblockUserMutation();
  const name = firstName(user.name);

  const unblock = async () => {
    try {
      await unblockUser(user._id).unwrap();
      toast.success(`${name} is unblocked`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <p className={`flex flex-wrap items-center justify-center gap-x-2 gap-y-1 ${NOTICE}`}>
      <Ban className="size-4 shrink-0" aria-hidden />
      {blockedByMe ? (
        <>
          You blocked {name} ·
          <button
            type="button"
            onClick={unblock}
            disabled={isLoading}
            className="font-semibold text-brand-600 hover:underline disabled:opacity-60 dark:text-brand-400"
          >
            {isLoading ? "Unblocking…" : "Unblock"}
          </button>
        </>
      ) : (
        "You can't reply to this conversation"
      )}
    </p>
  );
}

// /inbox/:conversationId. Every conversation gets a fresh screen (scroll position, draft, dialogs).
export default function ChatView() {
  const { conversationId } = useParams();
  return <ChatScreen key={conversationId} conversationId={conversationId} />;
}

function ChatScreen({ conversationId }) {
  // Came from inside the app → go back there (the list, or the listing); a shared link → the inbox.
  const goBack = useGoBack("/inbox");
  const [params, setParams] = useSearchParams();
  const dispatch = useDispatch();
  const me = useSelector((state) => state.auth.user);
  const outbox = useSelector((state) => state.chat.outbox[conversationId] ?? NO_MESSAGES);
  const typing = useSelector((state) => Boolean(state.chat.typing[conversationId]));

  const { data, isLoading, isError, error } = useGetConversationQuery(conversationId);
  const conversation = data?.conversation;
  const {
    data: messagePages,
    isLoading: loadingMessages,
    isError: messagesFailed,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    refetch: refetchMessages,
  } = useGetMessagesInfiniteQuery(conversationId);
  const [markRead] = useMarkReadMutation();
  const [offerDialog, setOfferDialog] = useState({ open: false, offer: null });
  const listRef = useRef(null); // MessageList's { showOffer }

  // A blocked chat only says "blocked": my own list of blocks tells whether the block is mine.
  const blocked = Boolean(conversation?.blocked);
  const { data: myBlocks } = useGetBlocksQuery(undefined, { skip: !blocked });
  const blockedByMe = blocked && Boolean(myBlocks?.blocks.some((block) => block.user._id === conversation.otherUser._id));

  // Tells the socket handlers which chat is on screen (no unread bump, no toast for it), and clears
  // the toast that may still be announcing this chat.
  useEffect(() => {
    dispatch(setActiveConversation(conversationId));
    toast.dismiss(chatToastId(conversationId));
    return () => dispatch(setActiveConversation(null));
  }, [dispatch, conversationId]);

  // Oldest first. Pages arrive newest-first, each one oldest → newest; unsent messages go last.
  const messages = useMemo(() => {
    const seen = new Set();
    const saved = [...(messagePages?.pages ?? [])]
      .reverse()
      .flatMap((page) => page.messages)
      .filter((message) => !seen.has(message._id) && seen.add(message._id));
    const unsent = outbox.map((item) => ({ ...item, _id: item.clientId, type: item.image ? "image" : "text", sender: me._id }));
    return [...saved, ...unsent];
  }, [messagePages, outbox, me._id]);

  // Mark the chat read while it's on screen: when it opens with unread messages, when a new one
  // arrives, and when the tab comes back into view. Debounced; the server ignores repeats.
  const loaded = Boolean(conversation);
  const unreadCount = conversation?.unreadCount ?? 0;
  const lastIncomingId = useMemo(() => messages.findLast((message) => !message.status && isFromOther(message, me._id))?._id, [messages, me._id]);
  const readUpTo = useRef(null);
  useEffect(() => {
    if (!loaded || (unreadCount === 0 && (!lastIncomingId || lastIncomingId === readUpTo.current))) return undefined;

    const markIfVisible = () => {
      if (document.visibilityState !== "visible") return;
      readUpTo.current = lastIncomingId;
      markRead(conversationId);
    };
    const timer = setTimeout(markIfVisible, 400);
    document.addEventListener("visibilitychange", markIfVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", markIfVisible);
    };
  }, [loaded, unreadCount, lastIncomingId, conversationId, markRead]);

  // The pinned offer bar's "View", and "Make an offer" while one is already waiting: show its card.
  const showOffer = (offerId) => listRef.current?.showOffer(offerId);

  const openOfferDialog = () => {
    const pending = conversation.activeOffer && offerStatus(conversation.activeOffer) === "pending";
    if (pending) {
      showOffer(conversation.activeOffer._id);
      toast.info("There's already an offer waiting for a reply");
    } else if (!canMakeOffer(conversation)) {
      toast.error(chatClosedReason(conversation) ?? "This listing isn't taking offers right now.");
    } else {
      setOfferDialog({ open: true, offer: null });
    }
  };

  // "Make offer" on a listing page lands here with ?offer=1.
  const wantsOffer = params.get("offer") === "1";
  useEffect(() => {
    if (!wantsOffer || !loaded) return;
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("offer");
        return next;
      },
      { replace: true },
    );
    openOfferDialog();
    // Runs once per ?offer=1: removing the param ends it.
  }, [wantsOffer, loaded]);

  // A failed background refetch keeps what's already loaded on screen; only nothing at all is an error.
  if (isError && !data) {
    const missing = error?.status === 404;
    return (
      <div className={SHELL}>
        <BackOnlyHeader onBack={goBack} />
        <div className="grid flex-1 place-items-center p-6">
          <EmptyState
            icon={SearchX}
            title={missing ? "Chat not found" : "Couldn't load this chat"}
            description={missing ? "It doesn't exist, or it isn't one of yours." : error?.message}
            action={
              <Link to="/inbox" className={buttonClasses({ variant: "secondary" })}>
                Back to chats
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  if (isLoading || !conversation) {
    return (
      <div className={SHELL} role="status" aria-label="Loading chat">
        <div className="flex items-center gap-3 border-b border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          {/* On phones this screen covers everything, so it needs its own way out (a cold server can be slow). */}
          <BackButton onBack={goBack} />
          <Skeleton className="size-10 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <MessagesSkeleton />
      </div>
    );
  }

  const closedReason = chatClosedReason(conversation);
  const counter = (offer) => setOfferDialog({ open: true, offer });

  return (
    <div className={SHELL}>
      <ChatHeader conversation={conversation} blockedByMe={blockedByMe} onBack={goBack} />
      {conversation.deal && <DealBanner conversation={conversation} myId={me._id} />}
      <ActiveOfferBar conversation={conversation} myId={me._id} onView={showOffer} />

      {messagesFailed && !messagePages ? (
        <div className="grid flex-1 place-items-center p-6 text-center">
          <div>
            <p className="font-semibold">Couldn't load the messages</p>
            <button type="button" onClick={refetchMessages} className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400">
              <RefreshCw className="size-3.5" /> Try again
            </button>
          </div>
        </div>
      ) : loadingMessages ? (
        <MessagesSkeleton />
      ) : (
        <MessageList
          ref={listRef}
          conversation={conversation}
          myId={me._id}
          messages={messages}
          typing={typing}
          hasOlder={hasNextPage}
          loadingOlder={isFetchingNextPage}
          loadOlderFailed={isFetchNextPageError}
          pageCount={messagePages?.pages.length ?? 0}
          onLoadOlder={fetchNextPage}
          onCounter={counter}
          onRetry={(message) =>
            dispatch(sendChatMessage({ conversationId, clientId: message.clientId, text: message.text, imageUrl: message.image?.url }))
          }
          onDiscard={(message) => dispatch(dropQueuedMessage(conversationId, message.clientId))}
        />
      )}

      {blocked ? (
        <BlockedNotice user={conversation.otherUser} blockedByMe={blockedByMe} />
      ) : closedReason ? (
        <p className={`flex items-center justify-center gap-2 ${NOTICE}`}>
          <Lock className="size-4 shrink-0" aria-hidden /> {closedReason}
        </p>
      ) : (
        <Composer conversationId={conversationId} offerDisabled={!canMakeOffer(conversation)} onMakeOffer={openOfferDialog} />
      )}

      <OfferDialog
        open={offerDialog.open}
        offer={offerDialog.offer}
        conversation={conversation}
        onClose={() => setOfferDialog({ open: false, offer: null })}
      />
    </div>
  );
}
