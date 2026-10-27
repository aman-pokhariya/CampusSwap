import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { ArrowRight, Building, PackageOpen, Plus, RefreshCw, SearchX, SlidersHorizontal } from "lucide-react";
import ListingGrid from "../components/listings/ListingGrid";
import {
  ActiveFilterChips,
  FilterPanel,
  PANEL_FILTER_KEYS,
  SearchInput,
  SortSelect,
  TypeChips,
} from "../components/listings/FeedFilters";
import Button, { buttonClasses } from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import Alert from "../components/ui/Alert";
import { useGetFeedInfiniteQuery } from "../api/listings.api";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";

const FILTER_KEYS = ["q", "type", "category", "condition", "minPrice", "maxPrice", "within", "sort"];

const greetingFor = (hour) => (hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening");

function HostelNudge() {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-amber-500/30 dark:bg-amber-500/10">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
          <Building className="size-5" />
        </span>
        <div>
          <p className="font-semibold text-amber-900 dark:text-amber-100">Add your hostel</p>
          <p className="text-sm text-amber-800/80 dark:text-amber-200/80">See how far each item is, and let nearby students find yours first.</p>
        </div>
      </div>
      <Link to="/settings" className={buttonClasses({ variant: "secondary", size: "sm" })}>
        Set hostel <ArrowRight className="size-4" />
      </Link>
    </section>
  );
}

export default function Home() {
  const user = useSelector((state) => state.auth.user);
  const [params, setParams] = useSearchParams();

  // Filters live in the URL: they survive refreshes, the back button keeps them, and links can be shared.
  const filters = useMemo(
    () => Object.fromEntries(FILTER_KEYS.flatMap((key) => (params.get(key) ? [[key, params.get(key)]] : []))),
    [params],
  );

  const updateFilters = useCallback(
    (patch) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(patch)) {
            if (value === undefined || value === null || value === "") next.delete(key);
            else next.set(key, String(value));
          }
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  // The search box writes to the URL once you pause typing.
  const [search, setSearch] = useState(filters.q ?? "");
  const debouncedSearch = useDebouncedValue(search);
  const lastPushedQuery = useRef(filters.q ?? "");

  useEffect(() => {
    const q = debouncedSearch.trim();
    if (q === lastPushedQuery.current) return;
    lastPushedQuery.current = q;
    updateFilters({ q });
  }, [debouncedSearch, updateFilters]);

  // ...and follows the URL when it changes some other way (back button, "clear filters").
  useEffect(() => {
    const q = filters.q ?? "";
    if (q !== lastPushedQuery.current) {
      lastPushedQuery.current = q;
      setSearch(q);
    }
  }, [filters.q]);

  const sort = filters.sort ?? (filters.q ? "relevance" : "newest");
  const { data, isLoading, isFetching, isFetchingNextPage, isError, isFetchNextPageError, error, hasNextPage, fetchNextPage, refetch } =
    useGetFeedInfiniteQuery({ ...filters, sort, limit: 12 });

  // Pages can overlap if new listings arrive while scrolling; show each listing once.
  const listings = useMemo(() => {
    const seen = new Set();
    return (data?.pages ?? []).flatMap((page) => page.listings).filter((l) => !seen.has(l._id) && seen.add(l._id));
  }, [data]);

  // After a failed page, wait for Retry: the sentinel is still in view and would fire again at once.
  const sentinelRef = useInfiniteScroll(() => fetchNextPage(), {
    enabled: hasNextPage && !isFetching && !isError,
    pageCount: data?.pages.length ?? 0,
  });

  const panelFilterCount = PANEL_FILTER_KEYS.filter((key) => filters[key]).length;
  const [panelOpen, setPanelOpen] = useState(panelFilterCount > 0);
  const isFiltered = panelFilterCount > 0 || Boolean(filters.type || filters.q);
  const refreshing = isFetching && !isFetchingNextPage && !isLoading;

  const clearAll = () => {
    setSearch("");
    lastPushedQuery.current = "";
    setParams({}, { replace: true });
  };

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          {greetingFor(new Date().getHours())}, {user.name.split(" ")[0]} 👋
        </p>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Explore {user.campus.shortName}</h1>
      </header>

      {!user.hostel && <HostelNudge />}

      {/* Sticks under the navbar while you scroll */}
      <div className="sticky top-16 z-30 -mx-4 space-y-3 bg-slate-50/85 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 dark:bg-slate-950/85">
        <div className="flex gap-2">
          <SearchInput value={search} onChange={setSearch} />
          <button
            type="button"
            onClick={() => setPanelOpen((open) => !open)}
            aria-expanded={panelOpen}
            className={`relative inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold shadow-sm transition ${
              panelOpen
                ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            <SlidersHorizontal className="size-4" />
            <span className="hidden sm:inline">Filters</span>
            {panelFilterCount > 0 && (
              <span className="grid size-5 place-items-center rounded-full bg-brand-600 text-[11px] font-bold text-white">
                {panelFilterCount}
              </span>
            )}
          </button>
          <SortSelect
            value={sort}
            onChange={(value) => updateFilters({ sort: value })}
            hasQuery={Boolean(filters.q)}
            className="hidden sm:block"
          />
        </div>
        <TypeChips value={filters.type} onChange={(type) => updateFilters({ type })} />
      </div>

      {panelOpen && (
        <FilterPanel
          filters={filters}
          sort={sort}
          onChange={updateFilters}
          onReset={() => updateFilters(Object.fromEntries(PANEL_FILTER_KEYS.map((key) => [key, undefined])))}
        />
      )}
      <ActiveFilterChips filters={filters} onRemove={(key) => updateFilters({ [key]: undefined })} />

      {/* Only a failed first page (or a failed refresh) replaces the grid: a failed "more" keeps the
          listings already loaded, with a Retry under them. (`data` can't tell: after a search or
          filter change it still holds the previous results.) */}
      {isError && !isFetchNextPageError ? (
        <Alert type="error" title="Couldn't load listings">
          <p>{error?.message}</p>
          <button type="button" onClick={refetch} className="mt-2 inline-flex items-center gap-1.5 font-semibold underline">
            <RefreshCw className="size-3.5" /> Try again
          </button>
        </Alert>
      ) : isLoading ? (
        <ListingGrid listings={[]} loading />
      ) : listings.length === 0 ? (
        isFiltered ? (
          <EmptyState
            icon={SearchX}
            title="No matches"
            description="Try a different search, or remove some filters."
            action={<Button variant="secondary" onClick={clearAll}>Clear search & filters</Button>}
          />
        ) : (
          <EmptyState
            icon={PackageOpen}
            title={`Nothing on ${user.campus.shortName} yet`}
            description="Be the first to post. It takes under a minute, and someone in your hostel is probably looking for it."
            action={
              <Link to="/sell" className={buttonClasses({ variant: "gradient" })}>
                <Plus className="size-4" /> Post a listing
              </Link>
            }
          />
        )
      ) : (
        <div className={`transition-opacity ${refreshing ? "opacity-60" : ""}`} aria-busy={refreshing}>
          <ListingGrid listings={listings} loading={isFetchingNextPage} skeletons={4} />
        </div>
      )}

      <div ref={sentinelRef} aria-hidden />
      {isFetchNextPageError && (
        <p className="flex items-center justify-center gap-1.5 py-3 text-sm text-slate-500 dark:text-slate-400">
          Couldn't load more listings ·
          <button type="button" onClick={() => fetchNextPage()} className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
            Retry
          </button>
        </p>
      )}
      {!hasNextPage && listings.length > 0 && (
        <p className="py-4 text-center text-sm text-slate-400 dark:text-slate-500">
          That's everything on {user.campus.shortName} for now 🎉
        </p>
      )}
    </div>
  );
}
