import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { buttonClasses } from "../components/ui/Button";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="animate-fade-up text-center">
        <p className="bg-linear-to-r from-brand-600 via-violet-600 to-fuchsia-600 bg-clip-text text-8xl font-extrabold text-transparent">
          404
        </p>
        <h1 className="mt-4 text-2xl font-bold">This page moved to a different hostel</h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400">The page you're looking for doesn't exist or has moved.</p>
        <Link to="/" className={buttonClasses({ className: "mt-8" })}>
          <ArrowLeft className="size-4" /> Back to CampusSwap
        </Link>
      </div>
    </div>
  );
}
