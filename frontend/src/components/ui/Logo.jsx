import { Link } from "react-router-dom";
import { ArrowLeftRight } from "lucide-react";

const MARK_SIZES = {
  sm: "size-8 rounded-lg [&>svg]:size-4",
  md: "size-9 rounded-xl [&>svg]:size-5",
  lg: "size-14 rounded-2xl [&>svg]:size-7",
};

export function LogoMark({ size = "md", className = "" }) {
  return (
    <span
      className={`grid shrink-0 place-items-center bg-linear-to-br from-brand-500 via-violet-500 to-fuchsia-500 text-white shadow-lg shadow-brand-500/30 ${MARK_SIZES[size]} ${className}`}
    >
      <ArrowLeftRight strokeWidth={2.5} aria-hidden />
    </span>
  );
}

export default function Logo({ to = "/", size = "md" }) {
  return (
    <Link
      to={to}
      aria-label="CampusSwap home"
      className="group inline-flex items-center gap-2.5 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-500"
    >
      <LogoMark size={size} className="transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-6" />
      <span className={`font-extrabold tracking-tight ${size === "sm" ? "text-base" : "text-lg"}`}>
        Campus
        <span className="bg-linear-to-r from-brand-600 to-fuchsia-600 bg-clip-text text-transparent dark:from-brand-400 dark:to-fuchsia-400">
          Swap
        </span>
      </span>
    </Link>
  );
}
