import { Sprout } from "lucide-react";
import { isNewMember, trustLevel, trustScore } from "../../utils/trust";

// Box size (Tailwind), stroke width (in the SVG's 0–100 coordinates) and number size.
const SIZES = {
  sm: { box: "size-9", stroke: 10, number: "text-[11px]", icon: "size-4" },
  md: { box: "size-13", stroke: 9, number: "text-sm", icon: "size-5" },
  lg: { box: "size-24", stroke: 7, number: "text-2xl", icon: "size-8" },
};

const TONES = {
  high: "stroke-emerald-500",
  mid: "stroke-brand-500",
  low: "stroke-amber-500",
};

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// A trust score (0–100) as a ring that fills up, or "New member" while there's nothing to score yet:
// no trust record, or no finished deals and no reviews (A9). `showLabel` adds a word underneath.
// The small size shows "New member" as a chip, because a ring that small can't hold the words.
export default function TrustRing({ trust, size = "md", showLabel = false, className = "" }) {
  const { box, stroke, number, icon } = SIZES[size];

  if (isNewMember(trust)) {
    if (size === "sm") {
      return (
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300 ${className}`}
        >
          <Sprout className="size-3" aria-hidden /> New member
        </span>
      );
    }
    return (
      <span role="img" aria-label="New member: no finished deals or reviews yet" className={`inline-flex shrink-0 flex-col items-center gap-1.5 ${className}`}>
        <span
          className={`grid ${box} place-items-center rounded-full border-2 border-dashed border-emerald-300 bg-emerald-50 text-emerald-600 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-400`}
        >
          <Sprout className={icon} aria-hidden />
        </span>
        {showLabel && <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">New member</span>}
      </span>
    );
  }

  const score = trustScore(trust);
  const { label, tone } = trustLevel(score);

  return (
    <span
      role="img"
      aria-label={`Trust score ${score} out of 100, ${label.toLowerCase()}`}
      className={`inline-flex shrink-0 flex-col items-center gap-1.5 ${className}`}
    >
      <span className={`relative grid ${box} place-items-center`}>
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r={RADIUS} fill="none" strokeWidth={stroke} className="stroke-slate-200 dark:stroke-slate-700" />
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${(score / 100) * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            className={`transition-[stroke-dasharray] duration-700 ${TONES[tone]}`}
          />
        </svg>
        <span className={`relative font-extrabold tabular-nums ${number}`}>{score}</span>
      </span>
      {showLabel && <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Trust · {label}</span>}
    </span>
  );
}
