import { useMemo, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { CircleX, Handshake, LoaderCircle, MessageCircle, PackageCheck, RefreshCw } from "lucide-react";
import DealCard, { DealCardSkeleton } from "../../components/deals/DealCard";
import EmptyState from "../../components/ui/EmptyState";
import Alert from "../../components/ui/Alert";
import { buttonClasses } from "../../components/ui/Button";
import { useGetDealsInfiniteQuery } from "../../api/deals.api";
import { useInfiniteScroll } from "../../hooks/useInfiniteScroll";
import { DEAL_TABS } from "../../constants/deals";

const EMPTY = {
  active: {
    icon: Handshake,
    title: "No active deals",
    description: "When an offer is accepted, the deal shows up here: pick a safe spot, meet, and hand over with a code.",
  },
  completed: {
    icon: PackageCheck,
    title: "No completed deals yet",
    description: "Finished handovers land here, with your reviews.",
  },
  cancelled: {
    icon: CircleX,
    title: "Nothing cancelled",
    description: "Deals that fall through show up here.",
  },
};

// /deals?tab=active|completed|cancelled. The tab lives in the URL, so going back from a deal returns
// to the same one.
export default function Deals() {
  const me = useSelector((state) => state.auth.user);
  const dealsNeedingMe = useSelector((state) => state.chat.unread.deals);
  const [params, setParams] = useSearchParams();
  const tab = DEAL_TABS.some((option) => option.value === params.get("tab")) ? params.get("tab") : "active";
  const tabRefs = useRef([]);

  const { data, isLoading, isError, error, refetch, hasNextPage, fetchNextPage, isFetching, isFetchingNextPage, isFetchNextPageError } =
    useGetDealsInfiniteQuery(tab);

  // Most recently changed first, each deal once (a deal that changes while pages load can repeat).
  const deals = useMemo(() => {
    const seen = new Set();
    return (data?.pages ?? [])
      .flatMap((page) => page.deals)
      .filter((deal) => !seen.has(deal._id) && seen.add(deal._id))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }, [data]);

  // After a failed page, wait for Retry: the sentinel is still in view and would fire again at once.
  const sentinelRef = useInfiniteScroll(() => fetchNextPage(), {
    enabled: hasNextPage && !isFetching && !isFetchNextPageError,
    pageCount: data?.pages.length ?? 0,
  });

  const selectTab = (value) => setParams(value === "active" ? {} : { tab: value }, { replace: true });

  // Arrow keys move between tabs (the usual tablist keyboard pattern).
  const handleTabKeyDown = (event, index) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + DEAL_TABS.length) % DEAL_TABS.length;
    selectTab(DEAL_TABS[next].value);
    tabRefs.current[next]?.focus();
  };

  const empty = EMPTY[tab];
  let content;
  if (isError && !data) {
    content = (
      <Alert type="error" title="Couldn't load your deals">
        <p>{error?.message}</p>
        <button type="button" onClick={refetch} className="mt-2 inline-flex items-center gap-1.5 font-semibold underline">
          <RefreshCw className="size-3.5" /> Try again
        </button>
      </Alert>
    );
  } else if (isLoading) {
    content = (
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {[1, 2, 3, 4].map((n) => (
          <DealCardSkeleton key={n} />
        ))}
      </div>
    );
  } else if (deals.length === 0) {
    content = (
      <EmptyState
        icon={empty.icon}
        title={empty.title}
        description={empty.description}
        action={
          tab === "active" && (
            <Link to="/inbox" className={buttonClasses({ variant: "secondary" })}>
              <MessageCircle className="size-4" /> Go to chats
            </Link>
          )
        }
      />
    );
  } else {
    content = (
      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {deals.map((deal) => (
          <li key={deal._id} className="min-w-0">
            <DealCard deal={deal} myId={me._id} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="animate-fade-up space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Deals</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">Meetups, handovers and reviews for everything you've agreed on.</p>
        </div>
        {dealsNeedingMe > 0 && (
          <p className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1.5 text-xs font-bold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
            <span className="size-1.5 rounded-full bg-rose-500" aria-hidden />
            {dealsNeedingMe} {dealsNeedingMe === 1 ? "deal needs" : "deals need"} you
          </p>
        )}
      </header>

      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 sm:w-fit dark:bg-slate-800/70" role="tablist" aria-label="Deals">
        {DEAL_TABS.map(({ value, label }, index) => (
          <button
            key={value}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`deals-tab-${value}`}
            aria-selected={tab === value}
            aria-controls="deals-panel"
            tabIndex={tab === value ? 0 : -1}
            onClick={() => selectTab(value)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-brand-500 sm:flex-none sm:px-4 ${
              tab === value
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div id="deals-panel" role="tabpanel" aria-labelledby={`deals-tab-${tab}`} aria-busy={isFetching && !isFetchingNextPage}>
        {content}
        <div ref={sentinelRef} aria-hidden />
        {isFetchingNextPage && (
          <div className="flex justify-center py-4">
            <LoaderCircle className="size-5 animate-spin text-brand-500" aria-label="Loading more deals" />
          </div>
        )}
        {isFetchNextPageError && (
          <p className="flex items-center justify-center gap-1.5 py-4 text-sm text-slate-500 dark:text-slate-400">
            Couldn't load more deals ·
            <button type="button" onClick={() => fetchNextPage()} className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
              Retry
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
