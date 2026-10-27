import { Suspense, useEffect, useMemo, useState } from "react";
import { Link, Outlet, useParams, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { Compass, ListFilter, LoaderCircle, MessagesSquare, RefreshCw, Search, SearchX, X } from "lucide-react";
import ConversationItem, { ConversationItemSkeleton } from "../../components/chat/ConversationItem";
import EmptyState from "../../components/ui/EmptyState";
import Alert from "../../components/ui/Alert";
import Button, { buttonClasses } from "../../components/ui/Button";
import { useGetConversationsInfiniteQuery } from "../../api/chat.api";
import { useInfiniteScroll } from "../../hooks/useInfiniteScroll";
import { watchPresence } from "../../socket/socket";

const matches = (conversation, query) =>
  [conversation.otherUser.name, conversation.listing.title, conversation.lastMessage?.text].some((text) =>
    text?.toLowerCase().includes(query),
  );

function PaneLoader() {
  return (
    <div className="grid h-full min-h-[40vh] place-items-center" role="status" aria-label="Loading chat">
      <LoaderCircle className="size-6 animate-spin text-brand-500" />
    </div>
  );
}

// /inbox and /inbox/:conversationId. Wide screens: the list and the open chat side by side.
// Phones: the list, and a chat opens full screen on top of it (ChatView).
// ?listing=<id> narrows the list to the chats about one of my listings.
export default function Inbox() {
  const { conversationId } = useParams();
  const [params, setParams] = useSearchParams();
  const listingFilter = params.get("listing") ?? undefined;
  const me = useSelector((state) => state.auth.user);
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, error, refetch, hasNextPage, fetchNextPage, isFetching, isFetchingNextPage, isFetchNextPageError } =
    useGetConversationsInfiniteQuery({ listing: listingFilter });

  // Newest activity first, each chat once (a live update can leave a chat in an older page).
  const conversations = useMemo(() => {
    const seen = new Set();
    return (data?.pages ?? [])
      .flatMap((page) => page.conversations)
      .filter((conversation) => !seen.has(conversation._id) && seen.add(conversation._id))
      .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
  }, [data]);

  // Online dots for everyone in the list (socket.js batches the requests).
  useEffect(() => {
    watchPresence(conversations.map((conversation) => conversation.otherUser._id));
  }, [conversations]);

  // After a failed page, wait for Retry: the sentinel is still in view and would fire again at once.
  const sentinelRef = useInfiniteScroll(() => fetchNextPage(), {
    enabled: hasNextPage && !isFetching && !isFetchNextPageError,
    pageCount: data?.pages.length ?? 0,
  });

  const query = search.trim().toLowerCase();
  const shown = query ? conversations.filter((conversation) => matches(conversation, query)) : conversations;
  const filterTitle = listingFilter ? conversations[0]?.listing.title : null;
  const linkSearch = listingFilter ? `?listing=${listingFilter}` : "";
  // No chats to pick from (none yet, or they didn't load): one message across the whole width,
  // instead of a list saying "no chats" next to a pane saying "pick a chat".
  const listOnly = !conversationId && !isLoading && conversations.length === 0;

  const clearFilter = () =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("listing");
        return next;
      },
      { replace: true },
    );

  // A failed refetch or "load more" keeps the chats already on screen. A message that has the page to
  // itself (listOnly) stays a readable width on wide screens.
  const notice = listOnly ? "mx-2 md:mx-auto md:w-full md:max-w-xl" : "mx-2";
  let list;
  if (isError && !data) {
    list = (
      <Alert type="error" title="Couldn't load your chats" className={notice}>
        <p>{error?.message}</p>
        <button type="button" onClick={refetch} className="mt-2 inline-flex items-center gap-1.5 font-semibold underline">
          <RefreshCw className="size-3.5" /> Try again
        </button>
      </Alert>
    );
  } else if (isLoading) {
    list = Array.from({ length: 6 }, (_, i) => <ConversationItemSkeleton key={i} />);
  } else if (conversations.length === 0) {
    list = listingFilter ? (
      <EmptyState
        icon={MessagesSquare}
        title="No chats about this listing yet"
        description="When someone messages you about it, the chat shows up here."
        action={<Button variant="secondary" onClick={clearFilter}>Show all chats</Button>}
        className={notice}
      />
    ) : (
      <EmptyState
        icon={MessagesSquare}
        title="No chats yet"
        description="Find something you like and tap “Message seller”. Questions about your own listings land here too."
        action={
          <Link to="/home" className={buttonClasses({ variant: "secondary" })}>
            <Compass className="size-4" /> Explore listings
          </Link>
        }
        className={notice}
      />
    );
  } else if (shown.length === 0) {
    list = (
      <div className="flex flex-col items-center px-6 py-12 text-center">
        <SearchX className="size-8 text-slate-400" />
        <p className="mt-3 font-semibold">No chats match “{search.trim()}”</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Search looks at names, listing titles and the latest message.</p>
      </div>
    );
  } else {
    list = (
      <ul className="space-y-0.5">
        {shown.map((conversation) => (
          <li key={conversation._id}>
            <ConversationItem conversation={conversation} myId={me._id} search={linkSearch} />
          </li>
        ))}
      </ul>
    );
  }

  // Wide screens: exactly the height under the navbar (4rem + its 1px border), so only the panes scroll.
  return (
    <div
      className={`mx-auto max-w-6xl border-slate-200 md:grid md:h-[calc(100dvh-4rem-1px)] md:border-x dark:border-slate-800 ${
        listOnly ? "md:grid-cols-1" : "md:grid-cols-[22rem_minmax(0,1fr)]"
      }`}
    >
      <section
        aria-label="Chats"
        className={`${conversationId ? "hidden md:flex" : "flex"} min-h-0 animate-fade-up flex-col border-slate-200 md:animate-none md:bg-white dark:border-slate-800 md:dark:bg-slate-900 ${
          listOnly ? "" : "md:border-r"
        }`}
      >
        <div className="space-y-3 px-4 pt-6 pb-3 md:pt-5">
          <header>
            <h1 className="text-2xl font-extrabold tracking-tight">Chats</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Questions, offers and deals, all in one place.</p>
          </header>

          {listingFilter && (
            <button
              type="button"
              onClick={clearFilter}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-300 dark:hover:bg-brand-500/20"
            >
              <ListFilter className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">About: {filterTitle ?? "one listing"}</span>
              <X className="size-3.5 shrink-0" aria-hidden />
              <span className="sr-only">, tap to show all chats</span>
            </button>
          )}

          {conversations.length > 0 && (
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search chats"
                aria-label="Search chats"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pr-3 pl-10 text-base shadow-sm outline-hidden transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 pointer-fine:text-sm dark:border-slate-700 dark:bg-slate-900 md:dark:bg-slate-800/60"
              />
            </div>
          )}
        </div>

        <div className={`px-2 pb-28 md:min-h-0 md:flex-1 md:overflow-y-auto md:pb-3 ${listOnly ? "md:pt-6" : ""}`}>
          {list}
          <div ref={sentinelRef} aria-hidden />
          {isFetchingNextPage && (
            <div className="flex justify-center py-3">
              <LoaderCircle className="size-5 animate-spin text-brand-500" aria-label="Loading more chats" />
            </div>
          )}
          {isFetchNextPageError && (
            <p className="flex items-center justify-center gap-1.5 py-3 text-sm text-slate-500 dark:text-slate-400">
              Couldn't load more chats ·
              <button type="button" onClick={() => fetchNextPage()} className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
                Retry
              </button>
            </p>
          )}
        </div>
      </section>

      {!listOnly && (
        <div className={`${conversationId ? "" : "hidden"} min-h-0 md:flex md:flex-col`}>
          <Suspense fallback={<PaneLoader />}>
            <Outlet />
          </Suspense>
        </div>
      )}
    </div>
  );
}
