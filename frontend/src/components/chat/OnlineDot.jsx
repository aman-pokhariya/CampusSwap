// The green dot on an avatar while someone is online. Pass its size and position in className.
export default function OnlineDot({ className = "" }) {
  return <span className={`block rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900 ${className}`} aria-hidden />;
}
