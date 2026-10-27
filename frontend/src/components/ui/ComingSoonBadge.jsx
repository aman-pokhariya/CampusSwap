const VARIANTS = {
  default: "bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30",
  // On the brand gradient (the auth pages' showcase).
  onBrand: "bg-white/15 text-white ring-white/30",
};

// A small "Coming soon" pill for features that are designed but not built yet (Swap Circles,
// AI-written listings, eco impact), so the app never promises something it can't do today.
export default function ComingSoonBadge({ variant = "default", className = "" }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide whitespace-nowrap uppercase ring-1 ${VARIANTS[variant]} ${className}`}
    >
      Coming soon
    </span>
  );
}
