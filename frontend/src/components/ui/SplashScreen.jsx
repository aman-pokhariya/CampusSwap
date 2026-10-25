import { LogoMark } from "./Logo";

export default function SplashScreen() {
  return (
    <div className="grid min-h-dvh place-items-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4">
        <LogoMark size="lg" className="animate-pulse" />
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading your campus…</p>
      </div>
    </div>
  );
}
