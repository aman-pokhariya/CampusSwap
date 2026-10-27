import { RefreshCw } from "lucide-react";
import Alert from "../ui/Alert";
import Button from "../ui/Button";
import Skeleton from "../ui/Skeleton";
import { TypeVisual } from "../listings/ListingCard";
import { imageUrl } from "../../utils/image";
import { listingState, stateLabel } from "../../utils/listing";

// Small pieces every admin panel uses.

const CHIP_TONES = {
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  brand: "bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

export function Chip({ tone = "slate", children }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap ${CHIP_TONES[tone]}`}>{children}</span>;
}

// What decides which actions are open on someone: suspended, an admin, a demo account.
export function AccountChips({ user }) {
  if (!user) return null;
  return (
    <>
      {user.isBanned && <Chip tone="rose">Suspended</Chip>}
      {user.isAdmin && <Chip tone="brand">Admin</Chip>}
      {user.isDemo && <Chip tone="amber">Demo</Chip>}
    </>
  );
}

const STATE_TONES = { flagged: "amber", removed: "rose", deleted: "slate", reserved: "amber", sold: "emerald", expired: "slate" };

// "Under review", "Removed", "Reserved"...; nothing while a listing is simply live.
export function ListingStateChip({ listing }) {
  const label = stateLabel(listing);
  return label ? <Chip tone={STATE_TONES[listingState(listing)] ?? "slate"}>{label}</Chip> : null;
}

export function ListingThumb({ listing }) {
  const cover = listing.images?.[0]?.url;
  return (
    <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:size-20 dark:bg-slate-800">
      {cover ? (
        <img src={imageUrl(cover, { width: 160, height: 160 })} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <TypeVisual type={listing.type} className="size-full [&_span]:hidden [&_svg]:size-7" />
      )}
    </div>
  );
}

// A small segmented control that filters one list (Open · Resolved · Dismissed).
export function Segmented({ label, options, value, onChange }) {
  return (
    <div role="group" aria-label={label} className="inline-flex max-w-full gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/70">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-brand-500 ${
            value === option.value
              ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
              : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// "Load more" under a paged list, with a retry when the next page failed.
export function LoadMore({ query, label }) {
  const { hasNextPage, fetchNextPage, isFetchingNextPage, isFetchNextPageError } = query;
  if (!hasNextPage) return null;

  return (
    <div className="flex flex-col items-center gap-2 pt-1">
      {isFetchNextPageError && <p className="text-sm text-rose-600 dark:text-rose-400">Couldn't load more. Try again.</p>}
      <Button variant="secondary" size="sm" onClick={() => fetchNextPage()} loading={isFetchingNextPage}>
        {label}
      </Button>
    </div>
  );
}

export function PanelError({ title, error, onRetry }) {
  return (
    <Alert type="error" title={title}>
      <p>{error?.message}</p>
      <button type="button" onClick={onRetry} className="mt-2 inline-flex items-center gap-1.5 font-semibold underline">
        <RefreshCw className="size-3.5" aria-hidden /> Try again
      </button>
    </Alert>
  );
}

export function ListSkeleton({ rows = 3 }) {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: rows }, (_, n) => (
        <div key={n} className="flex gap-3 rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <Skeleton className="size-16 shrink-0 rounded-xl sm:size-20" />
          <div className="flex-1 space-y-2.5 py-1">
            <Skeleton className="h-4 w-28 rounded-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3.5 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
