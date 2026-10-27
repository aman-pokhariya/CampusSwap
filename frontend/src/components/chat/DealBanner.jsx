import { Link } from "react-router-dom";
import { Handshake } from "lucide-react";
import { useGetDealQuery } from "../../api/deals.api";
import { DEAL_LABELS } from "../../utils/chat";
import { nextStepHint } from "../../utils/deals";

const TONES = {
  live: {
    bar: "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-950/40",
    text: "text-emerald-900 focus-visible:outline-emerald-500 dark:text-emerald-100",
    hint: "text-emerald-800/80 dark:text-emerald-200/80",
    icon: "text-emerald-600 dark:text-emerald-400",
    pill: "text-emerald-800 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-500/30",
  },
  cancelled: {
    bar: "border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900",
    text: "text-slate-700 focus-visible:outline-brand-500 dark:text-slate-200",
    hint: "text-slate-500 dark:text-slate-400",
    icon: "text-slate-400",
    pill: "text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700",
  },
};

// The deal this chat led to, pinned under the header: where it stands and what happens next, with the
// way to the deal page (meetup, handover and reviews all happen there). The chat only knows the deal's
// status; the rest loads with the deal and follows deal:update from then on.
export default function DealBanner({ conversation, myId }) {
  const { deal: chip } = conversation;
  const { data } = useGetDealQuery(chip._id);
  const deal = data?.deal;
  const status = deal?.status ?? chip.status;
  const cancelled = status === "cancelled";
  const hint = deal && !cancelled ? nextStepHint(deal, myId) : null;
  const myMove = Boolean(deal?.needsAction || deal?.needsReview);
  const tone = cancelled ? TONES.cancelled : TONES.live;

  return (
    <div className={`border-b ${tone.bar}`}>
      <Link
        to={`/deals/${chip._id}`}
        className={`flex w-full items-center gap-3 px-4 py-2 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 ${tone.text}`}
      >
        <Handshake className={`size-4 shrink-0 ${tone.icon}`} aria-hidden />
        <span className="min-w-0 flex-1">
          <strong className="flex items-center gap-1.5 text-sm">
            {DEAL_LABELS[status] ?? "Deal"}
            {myMove && (
              <span className="size-1.5 shrink-0 rounded-full bg-rose-500">
                <span className="sr-only">, your move</span>
              </span>
            )}
          </strong>
          {hint && <span className={`block text-xs ${tone.hint}`}>{hint.text}</span>}
        </span>
        <span className={`shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold ring-1 ${tone.pill}`}>View deal</span>
      </Link>
    </div>
  );
}
