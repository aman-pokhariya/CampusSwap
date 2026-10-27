import { Check, X } from "lucide-react";
import { DEAL_STEPS } from "../../constants/deals";
import { DEAL_LABELS } from "../../utils/chat";
import { dealStep } from "../../utils/deals";

// Agreed → Meetup set → Handed over, each step "done", "current" or "todo". A cancelled deal keeps
// the steps it reached and ends in "Cancelled" instead of the handover.
const stepsOf = (deal) => {
  const reached = dealStep(deal);
  const cancelled = deal.status === "cancelled";
  return DEAL_STEPS.map((label, index) => {
    const number = index + 1;
    if (cancelled && number === DEAL_STEPS.length) return { label: "Cancelled", state: "cancelled" };
    if (number <= reached) return { label, state: "done" };
    if (!cancelled && number === reached + 1) return { label, state: "current" };
    return { label, state: "todo" };
  });
};

const STATE_WORDS = { done: "done", current: "next", todo: "not yet", cancelled: "the deal was cancelled" };

const CIRCLES = {
  done: "bg-emerald-500 text-white",
  current: "bg-white text-brand-600 ring-2 ring-brand-500 dark:bg-slate-900 dark:text-brand-400 dark:ring-brand-400",
  todo: "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500",
  cancelled: "bg-rose-500 text-white",
};

const LABELS = {
  done: "text-slate-700 dark:text-slate-200",
  current: "font-bold text-brand-700 dark:text-brand-300",
  todo: "text-slate-500 dark:text-slate-400",
  cancelled: "font-bold text-rose-600 dark:text-rose-400",
};

// The line into a step takes that step's colour.
const LINES = {
  done: "bg-emerald-500",
  current: "bg-brand-300 dark:bg-brand-500/50",
  todo: "bg-slate-200 dark:bg-slate-700",
  cancelled: "bg-rose-300 dark:bg-rose-500/50",
};

const BARS = {
  done: "bg-emerald-500",
  current: "bg-brand-200 dark:bg-brand-500/30",
  todo: "bg-slate-200 dark:bg-slate-700",
  cancelled: "bg-rose-400",
};

// The full stepper at the top of the deal page.
export default function DealStepper({ deal, className = "" }) {
  const steps = stepsOf(deal);

  return (
    <ol aria-label="Deal progress" className={`grid grid-cols-3 ${className}`}>
      {steps.map((step, index) => (
        <li key={step.label} aria-current={step.state === "current" ? "step" : undefined} className="relative flex flex-col items-center px-1 text-center">
          {/* The line from the previous step stops short of both circles: it's drawn after the previous circle, so it would cover it. */}
          {index > 0 && (
            <span
              aria-hidden
              className={`absolute top-4 right-[calc(50%_+_1.25rem)] left-[calc(-50%_+_1.25rem)] h-0.5 -translate-y-1/2 rounded-full ${LINES[step.state]}`}
            />
          )}
          <span className={`relative grid size-8 place-items-center rounded-full text-sm font-bold ${CIRCLES[step.state]}`} aria-hidden>
            {step.state === "done" ? (
              <Check className="size-4" strokeWidth={3} />
            ) : step.state === "cancelled" ? (
              <X className="size-4" strokeWidth={3} />
            ) : (
              index + 1
            )}
          </span>
          <span className={`mt-2 text-xs sm:text-sm ${LABELS[step.state]}`}>
            {step.label}
            <span className="sr-only">, {STATE_WORDS[step.state]}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

// Three bars and the status in a word, for deal cards.
export function MiniStepper({ deal, className = "" }) {
  const steps = stepsOf(deal);

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="flex flex-1 gap-1" aria-hidden>
        {steps.map((step) => (
          <span key={step.label} className={`h-1.5 flex-1 rounded-full ${BARS[step.state]}`} />
        ))}
      </div>
      <span className="shrink-0 text-[11px] font-bold text-slate-600 dark:text-slate-300">
        {DEAL_LABELS[deal.status] ?? "Deal"}
        <span className="sr-only">, step {dealStep(deal)} of {steps.length}</span>
      </span>
    </div>
  );
}
