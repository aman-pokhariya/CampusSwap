import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { GraduationCap, QrCode, Repeat, ShieldCheck } from "lucide-react";
import Logo from "../ui/Logo";
import ThemeToggle from "../ui/ThemeToggle";
import ComingSoonBadge from "../ui/ComingSoonBadge";
import SwapCircleDiagram from "../landing/SwapCircleDiagram";
import PageLoader from "../ui/PageLoader";

// `soon`: not in the app yet (a later update), so it's labelled.
const POINTS = [
  { icon: ShieldCheck, text: "Only students with a verified college email" },
  { icon: QrCode, text: "QR-confirmed handovers at campus safe spots" },
  { icon: Repeat, text: "Swap Circles find 3-way trades for you", soon: true },
];

function Showcase() {
  return (
    <aside className="relative hidden overflow-hidden bg-linear-to-br from-brand-700 via-violet-700 to-fuchsia-700 p-12 text-white lg:flex lg:flex-col lg:justify-between">
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, rgb(255 255 255 / 0.22) 1px, transparent 0)",
          backgroundSize: "22px 22px",
        }}
      />
      <div className="absolute -top-24 -right-24 size-96 rounded-full bg-fuchsia-400/30 blur-3xl" />
      <div className="absolute -bottom-32 -left-16 size-96 rounded-full bg-brand-400/30 blur-3xl" />

      <span className="relative inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold ring-1 ring-white/25 backdrop-blur">
        <GraduationCap className="size-4" /> Students-only marketplace
      </span>

      <div className="relative space-y-8">
        <h2 className="text-4xl leading-tight font-extrabold tracking-tight xl:text-5xl">
          Every deal on campus.
          <br />
          <span className="text-white/75">Verified, safe and fast.</span>
        </h2>
        <ul className="space-y-4">
          {POINTS.map(({ icon: Icon, text, soon }) => (
            <li key={text} className="flex items-center gap-3 text-white/90">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/15 ring-1 ring-white/20">
                <Icon className="size-[18px]" />
              </span>
              <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                {text} {soon && <ComingSoonBadge variant="onBrand" />}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative rounded-3xl bg-white/10 p-5 ring-1 ring-white/20 backdrop-blur-md">
        <p className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold">
          Swap Circle found · 3 students <ComingSoonBadge variant="onBrand" />
        </p>
        <p className="text-xs text-white/70">Everyone gets what they wanted. No cash needed.</p>
        <SwapCircleDiagram variant="onBrand" className="mx-auto mt-2 w-full max-w-xs" />
      </div>
    </aside>
  );
}

export default function AuthLayout() {
  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col px-4 py-5 sm:px-8">
        <header className="flex items-center justify-between">
          <Logo />
          <ThemeToggle />
        </header>
        <main className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md animate-fade-up">
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
        <p className="text-center text-xs text-slate-400 dark:text-slate-500">
          🔒 Only verified college emails can join CampusSwap.
        </p>
      </div>
      <Showcase />
    </div>
  );
}
