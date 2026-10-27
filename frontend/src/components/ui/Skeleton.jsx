// Grey placeholder shapes shown while content loads.
export default function Skeleton({ className = "" }) {
  return <div aria-hidden className={`animate-pulse rounded-lg bg-slate-200/80 dark:bg-slate-800 ${className}`} />;
}
