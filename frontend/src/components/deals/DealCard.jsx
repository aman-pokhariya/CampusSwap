import { Link } from "react-router-dom";
import Avatar from "../ui/Avatar";
import Skeleton from "../ui/Skeleton";
import TrustRing from "../trust/TrustRing";
import { TypeVisual } from "../listings/ListingCard";
import { MiniStepper } from "./DealStepper";
import { formatDealAmount, nextStepHint, roleLabel } from "../../utils/deals";
import { imageUrl } from "../../utils/image";

export const HINT_TONES = {
  action: "font-semibold text-brand-700 dark:text-brand-300",
  waiting: "text-slate-600 dark:text-slate-300",
  warning: "font-semibold text-amber-700 dark:text-amber-300",
  done: "text-emerald-700 dark:text-emerald-300",
  muted: "text-slate-500 dark:text-slate-400",
};

// A deal in the /deals list: what, how much, with whom (and how far they can be trusted), where it
// stands and what happens next. "Action needed" when the next move (or a review) is mine.
export default function DealCard({ deal, myId }) {
  const other = deal.otherUser;
  const hint = nextStepHint(deal, myId);
  const needsMe = deal.needsAction || deal.needsReview;

  return (
    <Link
      to={`/deals/${deal._id}`}
      className="group flex gap-4 rounded-3xl border border-slate-200 bg-white p-4 transition duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-900/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-slate-800 dark:bg-slate-900 dark:hover:shadow-black/30"
    >
      <div className="size-20 shrink-0 overflow-hidden rounded-2xl bg-slate-100 sm:size-24 dark:bg-slate-800">
        {deal.cover ? (
          <img src={imageUrl(deal.cover, { width: 192, height: 192 })} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <TypeVisual type={deal.listingType} className="size-full [&_span]:hidden [&_svg]:size-8" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
            {roleLabel(deal)}
          </span>
          {needsMe && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
              <span className="size-1.5 rounded-full bg-rose-500" aria-hidden /> Action needed
            </span>
          )}
        </div>
        <h3 className="mt-1.5 truncate font-bold">{deal.title}</h3>
        <p className="truncate text-sm font-extrabold text-slate-700 dark:text-slate-200">{formatDealAmount(deal)}</p>

        <div className="mt-2 flex min-w-0 items-center gap-2">
          <Avatar name={other?.name ?? "?"} src={other?.avatar?.url} size="xs" />
          <span className="min-w-0 truncate text-xs font-semibold text-slate-600 dark:text-slate-300">{other?.name ?? "CampusSwap member"}</span>
          <TrustRing trust={other?.trust} size="sm" className="ml-auto" />
        </div>

        <MiniStepper deal={deal} className="mt-3" />
        <p className={`mt-1.5 line-clamp-2 text-xs ${HINT_TONES[hint.tone]}`}>{hint.text}</p>
      </div>
    </Link>
  );
}

export function DealCardSkeleton() {
  return (
    <div className="flex gap-4 rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900" aria-hidden>
      <Skeleton className="size-20 shrink-0 rounded-2xl sm:size-24" />
      <div className="flex-1 space-y-2.5 py-1">
        <Skeleton className="h-4 w-24 rounded-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="h-1.5 w-full rounded-full" />
      </div>
    </div>
  );
}
