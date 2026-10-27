import { NavLink } from "react-router-dom";
import { useSelector } from "react-redux";
import { CircleUserRound, Compass, Heart, MessageCircle, Plus } from "lucide-react";
import CountBadge from "../ui/CountBadge";

// Bottom navigation on phones, like a native app. Hidden from md (tablet) up.
export default function MobileTabBar() {
  const user = useSelector((state) => state.auth.user);
  const unreadChats = useSelector((state) => state.chat.unread.chats);

  const items = [
    { to: "/home", label: "Explore", icon: Compass },
    { to: "/inbox", label: "Chats", icon: MessageCircle, count: unreadChats },
    { to: "/sell", label: "Sell", icon: Plus, primary: true },
    { to: "/saved", label: "Saved", icon: Heart },
    { to: `/u/${user._id}`, label: "Profile", icon: CircleUserRound },
  ];

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden dark:border-slate-800/80 dark:bg-slate-950/90"
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-5">
        {items.map(({ to, label, icon: Icon, primary, count }) => (
          <li key={label} className="flex">
            <NavLink
              to={to}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition ${
                  isActive && !primary ? "text-brand-600 dark:text-brand-400" : "text-slate-500 dark:text-slate-400"
                }`
              }
            >
              {primary ? (
                <span className="-mt-7 grid size-13 place-items-center rounded-2xl bg-linear-to-br from-brand-500 via-violet-500 to-fuchsia-500 text-white shadow-lg ring-4 shadow-brand-500/40 ring-white dark:ring-slate-950">
                  <Icon className="size-6" strokeWidth={2.5} />
                </span>
              ) : (
                <span className="relative">
                  <Icon className="size-[22px]" />
                  <CountBadge count={count} className="absolute -top-2 left-3.5" />
                </span>
              )}
              {label}
              {count > 0 && <span className="sr-only">, {count} unread</span>}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
