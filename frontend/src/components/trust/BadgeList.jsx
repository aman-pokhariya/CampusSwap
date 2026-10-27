import { useCallback, useRef, useState } from "react";
import { Award, Lock } from "lucide-react";
import { BADGE_ICONS } from "../../constants/trust";
import { useClickOutside } from "../../hooks/useClickOutside";

const EARNED_TONES = {
  verified: "bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400",
  first_deal: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
  trusted_seller: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
  top_rated: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
  generous: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400",
  swap_master: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400",
  eco_warrior: "bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400",
};
const LOCKED_TONE = "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500";

const TOOLTIP_WIDTH = 256;

const statusOf = ({ earned, progress }) => {
  if (earned) return "Earned";
  return progress ? `${progress.current} of ${progress.target}` : "Not yet";
};

// Profile badges, earned ones in colour and locked ones grey with their progress. Each badge's
// details show in a tooltip on hover, keyboard focus or a tap. The tooltip is placed inside the list
// (never past its edges, so it can't push a phone screen sideways); screen readers get the same
// details from text inside the button.
export default function BadgeList({ badges }) {
  const [open, setOpen] = useState(null); // { badge, left, top, arrow }
  const listRef = useRef(null);

  const close = useCallback(() => setOpen(null), []);
  useClickOutside(listRef, close, open !== null);

  // Under the badge, centred on it as far as the list's width allows.
  const show = (badge, button) => {
    const width = Math.min(TOOLTIP_WIDTH, listRef.current.clientWidth);
    const center = button.offsetLeft + button.offsetWidth / 2;
    const left = Math.min(Math.max(0, center - width / 2), listRef.current.clientWidth - width);
    // The arrow points at the badge, but stays clear of the tooltip's rounded corners.
    const arrow = Math.min(Math.max(center - left, 14), width - 14);
    setOpen({ badge, width, left, top: button.offsetTop + button.offsetHeight + 8, arrow });
  };

  const earnedCount = badges.filter((badge) => badge.earned).length;
  const shown = open?.badge;

  return (
    <div ref={listRef} className="relative">
      <p className="sr-only">
        {earnedCount} of {badges.length} badges earned.
      </p>
      <ul className="flex flex-wrap gap-2">
        {badges.map((badge) => {
          const Icon = BADGE_ICONS[badge.id] ?? Award;
          const { progress } = badge;
          return (
            <li key={badge.id}>
              <button
                type="button"
                onMouseEnter={(event) => show(badge, event.currentTarget)}
                onMouseLeave={close}
                onFocus={(event) => show(badge, event.currentTarget)}
                onBlur={close}
                onClick={(event) => show(badge, event.currentTarget)}
                className={`flex items-center gap-2.5 rounded-2xl border py-2 pr-3 pl-2 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
                  badge.earned
                    ? "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
                    : "border-dashed border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-slate-600"
                }`}
              >
                <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${badge.earned ? EARNED_TONES[badge.id] ?? EARNED_TONES.verified : LOCKED_TONE}`}>
                  <Icon className="size-[18px]" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className={`block text-xs font-bold ${badge.earned ? "" : "text-slate-600 dark:text-slate-300"}`}>{badge.label}</span>
                  <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                    {!badge.earned && <Lock className="size-3" aria-hidden />}
                    {statusOf(badge)}
                  </span>
                </span>
                <span className="sr-only">. {badge.description}</span>
                {!badge.earned && progress && (
                  <span
                    className="ml-1 h-1.5 w-10 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
                    aria-hidden
                  >
                    <span className="block h-full rounded-full bg-brand-500" style={{ width: `${(progress.current / progress.target) * 100}%` }} />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {shown && (
        <div
          aria-hidden
          className="pointer-events-none absolute z-20 animate-fade-up rounded-xl bg-slate-900 px-3 py-2.5 text-xs text-white shadow-xl dark:bg-slate-100 dark:text-slate-900"
          style={{ left: open.left, top: open.top, width: open.width }}
        >
          <span className="absolute -top-1 size-2 rotate-45 bg-slate-900 dark:bg-slate-100" style={{ left: open.arrow - 4 }} />
          <p className="font-bold">{shown.label}</p>
          <p className="mt-0.5 text-slate-300 dark:text-slate-600">{shown.description}</p>
          <p className={`mt-1.5 font-semibold ${shown.earned ? "text-emerald-300 dark:text-emerald-700" : "text-slate-300 dark:text-slate-600"}`}>
            {shown.earned ? "Earned ✓" : shown.progress ? `Progress: ${shown.progress.current} of ${shown.progress.target}` : "Not earned yet"}
          </p>
        </div>
      )}
    </div>
  );
}
