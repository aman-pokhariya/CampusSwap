import { ArrowRight, CircleCheck, Clock, Flag, Handshake, ShieldAlert, Store, Tag, Users } from "lucide-react";
import Skeleton from "../ui/Skeleton";
import { PanelError } from "./AdminShared";

const TONES = {
  brand: "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400",
  sky: "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400",
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  rose: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400",
  slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

const formatCount = (value) => value.toLocaleString("en-IN");

// One number with what it counts. `onOpen` adds a link to the tab where it can be worked on.
function KpiTile({ icon: Icon, label, value, hint, tone, onOpen, openLabel }) {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <span className={`grid size-9 place-items-center rounded-xl ${TONES[tone]}`}>
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <p className="mt-3 text-2xl font-extrabold tabular-nums">{formatCount(value)}</p>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      {hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      {onOpen && value > 0 && (
        <button
          type="button"
          onClick={onOpen}
          className="mt-2 -mb-1 inline-flex items-center gap-1 self-start rounded-md py-1 text-xs font-semibold text-brand-600 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-400"
        >
          {openLabel} <ArrowRight className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}

// The campus at a glance: members, listings by status, what's waiting for a moderator, finished deals.
// `query` is the page's useGetAdminOverviewQuery result (it also feeds the tab counts).
export default function AdminOverview({ query, onOpenTab }) {
  const { data, isLoading, isError, error, refetch } = query;

  if (isError && !data) return <PanelError title="Couldn't load the overview" error={error} onRetry={refetch} />;
  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-hidden>
        {Array.from({ length: 8 }, (_, n) => (
          <Skeleton key={n} className="h-32 rounded-2xl" />
        ))}
      </div>
    );
  }

  const { users, listings, reports, deals } = data;
  const { byStatus } = listings;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile icon={Flag} tone="rose" label="Open reports" value={reports.open} onOpen={() => onOpenTab("reports")} openLabel="Review reports" />
        <KpiTile
          icon={ShieldAlert}
          tone="amber"
          label="Listings under review"
          value={listings.flagged}
          onOpen={() => onOpenTab("listings")}
          openLabel="Review listings"
        />
        <KpiTile icon={Users} tone="brand" label="Verified students" value={users.total} hint={`+${formatCount(users.new7d)} in the last 7 days`} />
        <KpiTile icon={Handshake} tone="emerald" label="Deals completed" value={deals.completed30d} hint="In the last 30 days" />
        <KpiTile icon={Store} tone="sky" label="Live listings" value={byStatus.active} />
        <KpiTile icon={Clock} tone="amber" label="Reserved for a deal" value={byStatus.reserved} />
        <KpiTile icon={CircleCheck} tone="emerald" label="Sold or handed over" value={byStatus.sold} />
        <KpiTile icon={Tag} tone="slate" label="Expired" value={byStatus.expired} />
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Listing counts leave out anything under review or removed. Deleted listings aren't counted.
      </p>
    </div>
  );
}
