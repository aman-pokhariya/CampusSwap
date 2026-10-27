import { useCallback, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import { ChevronDown, CircleUserRound, FlaskConical, Gavel, Handshake, Heart, LogOut, Moon, Settings, ShieldCheck, Store, Sun } from "lucide-react";
import Avatar from "../ui/Avatar";
import CountBadge from "../ui/CountBadge";
import { authApi } from "../../api/auth.api";
import { baseApi } from "../../api/baseApi";
import { clearCurrentUser } from "../../redux/authSlice";
import { resetChat } from "../../redux/chatSlice";
import { toggleTheme } from "../../redux/themeSlice";
import { connectSocket, socket } from "../../socket/socket";
import { useClickOutside } from "../../hooks/useClickOutside";
import { getErrorMessage } from "../../utils/errors";
import { announceSession } from "../../utils/sessionSync";

const itemClasses =
  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition hover:bg-slate-100 dark:hover:bg-slate-800";

export default function UserMenu({ user }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const loggingOut = useRef(false);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const dealsNeedingMe = useSelector((state) => state.chat.unread.deals);
  const dark = useSelector((state) => state.theme.mode) === "dark";

  const close = useCallback(() => setOpen(false), []);
  useClickOutside(menuRef, close, open);

  const handleLogout = async () => {
    close();
    if (loggingOut.current) return; // already on its way (the menu can be reopened meanwhile)
    loggingOut.current = true;
    const toastId = toast.loading("Logging out…"); // a sleeping server can take a while
    // This tab closes its own live connection first. The server closes it too once the session ends,
    // and both sides closing at the same moment makes the browser log a "WebSocket is already closed" error.
    socket.disconnect();
    try {
      await authApi.logout();
    } catch (error) {
      // The session cookie is httpOnly, so only the server's answer can delete it. If the request didn't
      // get through (offline, a timeout, 429/5xx), this browser is still logged in: say so, never
      // "Logged out" (the next person at this computer would be in this account). A 401 means the
      // session is already gone.
      if (error.response?.status !== 401) {
        loggingOut.current = false;
        connectSocket(); // still logged in, so back to live updates
        toast.error("Couldn't log you out", {
          id: toastId,
          description: `${getErrorMessage(error)} You're still logged in on this device.`,
        });
        return;
      }
    }
    navigate("/", { replace: true });
    dispatch(clearCurrentUser());
    // The next user must not see this user's cached data or chat state.
    dispatch(baseApi.util.resetApiState());
    dispatch(resetChat());
    // Other tabs reload and find nobody logged in. Only after the request: before it, they would
    // reload with the cookie still valid.
    announceSession(null);
    toast.success("Logged out. See you soon!", { id: toastId });
  };

  // The Deals count: deals waiting for my next step, plus finished ones I haven't reviewed yet.
  const links = [
    { to: `/u/${user._id}`, icon: CircleUserRound, label: "My profile" },
    { to: "/my-listings", icon: Store, label: "My listings" },
    { to: "/deals", icon: Handshake, label: "Deals", count: dealsNeedingMe },
    { to: "/saved", icon: Heart, label: "Saved" },
    { to: "/settings", icon: Settings, label: "Settings" },
    ...(user.role === "admin" ? [{ to: "/admin", icon: Gavel, label: "Admin" }] : []),
  ];

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={dealsNeedingMe > 0 ? "Account menu, deals need your attention" : "Account menu"}
        className="flex items-center gap-1.5 rounded-full p-1 pr-2 transition hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <span className="relative">
          <Avatar name={user.name} src={user.avatar?.url} size="sm" />
          {dealsNeedingMe > 0 && (
            <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-950" aria-hidden />
          )}
        </span>
        <ChevronDown className={`size-4 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-72 origin-top-right animate-fade-up rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/40"
        >
          <div className="flex items-center gap-3 px-3 py-3">
            <Avatar name={user.name} src={user.avatar?.url} />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                {user.name}
                {user.role === "admin" && (
                  <span className="rounded-md bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-700 uppercase dark:bg-brand-500/20 dark:text-brand-300">
                    Admin
                  </span>
                )}
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
            </div>
          </div>
          <p className="mx-3 mb-2 flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            <ShieldCheck className="size-3.5" /> Verified student · {user.campus?.shortName}
          </p>
          {user.isDemo && (
            <p className="mx-3 mb-2 flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              <FlaskConical className="size-3.5" /> Demo account · resets daily
            </p>
          )}

          <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
          {links.map(({ to, icon: Icon, label, count }) => (
            <Link key={to} to={to} role="menuitem" onClick={close} className={itemClasses}>
              <Icon className="size-4 text-slate-500" /> {label}
              {count > 0 && (
                <span className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                  Needs you <CountBadge count={count} />
                  <span className="sr-only">({count})</span>
                </span>
              )}
            </Link>
          ))}
          {/* Also here because the navbar's theme button doesn't fit on the smallest phones. */}
          <button type="button" role="menuitem" onClick={() => dispatch(toggleTheme())} className={itemClasses}>
            {dark ? <Sun className="size-4 text-slate-500" /> : <Moon className="size-4 text-slate-500" />}
            {dark ? "Light mode" : "Dark mode"}
          </button>
          <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className={`${itemClasses} text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10`}
          >
            <LogOut className="size-4" /> Log out
          </button>
        </div>
      )}
    </div>
  );
}
