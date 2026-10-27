import { Link, NavLink } from "react-router-dom";
import { useSelector } from "react-redux";
import { Compass, Heart, MapPin, MessageCircle, Plus, Store } from "lucide-react";
import Logo from "../ui/Logo";
import ThemeToggle from "../ui/ThemeToggle";
import CountBadge from "../ui/CountBadge";
import { buttonClasses } from "../ui/Button";
import NotificationBell from "./NotificationBell";
import UserMenu from "./UserMenu";

const NAV_LINKS = [
  { to: "/home", label: "Explore", icon: Compass },
  { to: "/inbox", label: "Chats", icon: MessageCircle, badge: "chats" },
  { to: "/saved", label: "Saved", icon: Heart },
  { to: "/my-listings", label: "Selling", icon: Store },
];

const navLinkClasses = ({ isActive }) =>
  `flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
    isActive
      ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
  }`;

export default function AppNavbar() {
  const user = useSelector((state) => state.auth.user);
  const unread = useSelector((state) => state.chat.unread);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/75 backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-950/75">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Logo to="/home" />
          <span className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 lg:inline-flex dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            <MapPin className="size-3.5 text-brand-500" />
            {user.campus?.shortName}
          </span>
        </div>

        <div className="hidden items-center gap-1 md:flex">
          {/* Icons only on tablets (labels stay readable for screen readers), labels from lg up. */}
          {NAV_LINKS.map(({ to, label, icon: Icon, badge }) => (
            <NavLink key={to} to={to} title={label} className={navLinkClasses}>
              <Icon className="size-4" aria-hidden />
              <span className="sr-only lg:not-sr-only">{label}</span>
              {badge && unread[badge] > 0 && (
                <>
                  <CountBadge count={unread[badge]} />
                  <span className="sr-only">, {unread[badge]} unread</span>
                </>
              )}
            </NavLink>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="hidden md:block">
            <Link to="/sell" className={buttonClasses({ variant: "gradient", size: "sm" })}>
              <Plus className="size-4" /> Sell
            </Link>
          </span>
          <NotificationBell />
          {/* The smallest phones (320 px) only have room for the bell and the menu. */}
          <span className="hidden min-[360px]:block">
            <ThemeToggle />
          </span>
          <UserMenu user={user} />
        </div>
      </nav>
    </header>
  );
}
