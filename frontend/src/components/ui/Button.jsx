import { LoaderCircle } from "lucide-react";

const VARIANTS = {
  primary:
    "bg-brand-600 text-white shadow-lg shadow-brand-600/25 hover:bg-brand-700 focus-visible:outline-brand-600 dark:bg-brand-500 dark:hover:bg-brand-400",
  gradient:
    "bg-linear-to-r from-brand-600 via-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-600/30 hover:brightness-110 focus-visible:outline-violet-600",
  secondary:
    "bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50 focus-visible:outline-brand-600 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-slate-800",
  ghost:
    "text-slate-700 hover:bg-slate-100 focus-visible:outline-brand-600 dark:text-slate-300 dark:hover:bg-slate-800",
  danger: "bg-rose-600 text-white hover:bg-rose-700 focus-visible:outline-rose-600",
  // A quiet destructive action (Decline, Delete) next to louder buttons. Its own variant, because
  // adding text-rose-* to "ghost" would put two text colours on one element.
  "danger-ghost":
    "text-rose-600 hover:bg-rose-50 focus-visible:outline-rose-600 dark:text-rose-400 dark:hover:bg-rose-500/10",
};

const SIZES = {
  sm: "h-9 rounded-lg px-3.5 text-sm",
  md: "h-11 rounded-xl px-5 text-sm",
  lg: "h-12 rounded-xl px-6 text-base",
};

// Also used to style <Link>s as buttons: <Link className={buttonClasses({ variant: "secondary" })}>
export const buttonClasses = ({ variant = "primary", size = "md", className = "" } = {}) =>
  `inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap transition duration-200 select-none active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${className}`;

export default function Button({
  variant,
  size,
  loading = false,
  disabled = false,
  type = "button",
  className = "",
  children,
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, className })}
      {...props}
    >
      {loading && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
