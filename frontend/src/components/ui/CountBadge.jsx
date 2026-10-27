// A small red counter on an icon or link ("3", "99+"). Renders nothing for 0. It's only visual: the
// caller says the count in words for screen readers (sr-only text or an aria-label), so it isn't read twice.
export default function CountBadge({ count, className = "" }) {
  if (!count) return null;

  return (
    <span
      aria-hidden
      className={`grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1.5 text-[11px] leading-none font-bold text-white ring-2 ring-white tabular-nums dark:ring-slate-950 ${className}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
