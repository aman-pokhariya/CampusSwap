import { BookOpen, MapPin, MessageCircle, QrCode, ShieldCheck, Sparkles, Star } from "lucide-react";
import Avatar from "../ui/Avatar";
import ComingSoonBadge from "../ui/ComingSoonBadge";

const chip =
  "absolute rounded-2xl border border-slate-200/80 bg-white/90 shadow-xl shadow-slate-900/10 backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/90 dark:shadow-black/30";

// An illustration of what a listing looks like, not live data.
export default function HeroPreview() {
  return (
    <div className="relative mx-auto w-full max-w-sm sm:max-w-md" aria-hidden>
      <div className="absolute -inset-8 -z-10 rounded-[3rem] bg-linear-to-br from-brand-500/30 via-violet-500/20 to-fuchsia-500/30 blur-3xl" />

      <div className="rounded-3xl border border-white/70 bg-white/85 p-4 shadow-2xl shadow-brand-900/10 backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-900/85 dark:shadow-black/40">
        <div className="relative grid h-44 place-items-center overflow-hidden rounded-2xl bg-linear-to-br from-amber-100 via-orange-100 to-rose-200 sm:h-52 dark:from-amber-500/25 dark:via-orange-500/15 dark:to-rose-500/30">
          <BookOpen className="size-20 text-orange-600/70 dark:text-orange-200/80" strokeWidth={1.25} />
          <span className="absolute top-3 left-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-violet-700 shadow-sm dark:bg-slate-900/95 dark:text-violet-300">
            ⇄ Swap or buy
          </span>
          <span className="absolute top-3 right-3 rounded-full bg-emerald-500 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
            Like new
          </span>
        </div>

        <div className="mt-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-bold">Introduction to Algorithms (CLRS)</h3>
            <p className="mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <MapPin className="size-3.5" /> Hostel Block A · 300 m away
            </p>
          </div>
          <p className="text-xl font-extrabold text-brand-600 dark:text-brand-400">₹350</p>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/70">
          <div className="flex items-center gap-2.5">
            <Avatar name="Riya Kapoor" size="sm" />
            <div>
              <p className="text-sm font-semibold">Riya K.</p>
              <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <Star className="size-3 fill-amber-400 text-amber-400" /> 4.9 · CSE, 3rd year
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            <ShieldCheck className="size-3.5" /> Trust 94
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-semibold">
          <span className="grid h-10 place-items-center rounded-xl bg-brand-600 text-white">Make offer</span>
          <span className="flex h-10 items-center justify-center gap-1.5 rounded-xl ring-1 ring-slate-200 dark:ring-slate-700">
            <MessageCircle className="size-4" /> Chat
          </span>
        </div>
      </div>

      <div className={`${chip} -top-5 -right-3 animate-float px-3 py-2 sm:-right-8`}>
        <p className="flex items-center gap-2 text-xs font-semibold">
          <span className="grid size-7 place-items-center rounded-lg bg-emerald-500 text-white">
            <QrCode className="size-4" />
          </span>
          Handover verified ✓
        </p>
      </div>

      {/* AI drafting comes in a later update, so the chip says so. */}
      <div className={`${chip} top-1/3 -left-6 hidden animate-float px-3 py-2 [animation-delay:1.5s] sm:block`}>
        <p className="flex items-center gap-2 text-xs font-semibold">
          <Sparkles className="size-4 text-violet-500" /> AI-written listings <ComingSoonBadge />
        </p>
      </div>

      {/* Sits mostly below the card so it never covers the buttons. */}
      <div
        className={`${chip} -bottom-8 -left-3 flex animate-float items-center gap-2.5 py-2 pr-2 pl-2.5 [animation-delay:3s] sm:-left-10`}
      >
        <Avatar name="Karan Singh" size="xs" />
        <p className="text-xs">
          <span className="font-semibold">Karan</span> offered <span className="font-bold">₹300</span>
        </p>
        <span className="rounded-lg bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-white">Accept</span>
      </div>
    </div>
  );
}
