import { useSelector } from "react-redux";
import { MapPin } from "lucide-react";
import Logo from "../ui/Logo";
import ThemeToggle from "../ui/ThemeToggle";
import UserMenu from "./UserMenu";

export default function AppNavbar() {
  const user = useSelector((state) => state.auth.user);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/75 backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-950/75">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Logo to="/home" />
          <span className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 sm:inline-flex dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            <MapPin className="size-3.5 text-brand-500" />
            {user.campus?.shortName}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <UserMenu user={user} />
        </div>
      </nav>
    </header>
  );
}
