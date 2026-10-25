import { useCallback, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { toast } from "sonner";
import { ChevronDown, House, LogOut, Settings, ShieldCheck } from "lucide-react";
import Avatar from "../ui/Avatar";
import { authApi } from "../../api/auth.api";
import { clearCurrentUser } from "../../redux/authSlice";
import { useClickOutside } from "../../hooks/useClickOutside";

const itemClasses =
  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition hover:bg-slate-100 dark:hover:bg-slate-800";

export default function UserMenu({ user }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const close = useCallback(() => setOpen(false), []);
  useClickOutside(menuRef, close, open);

  const handleLogout = async () => {
    close();
    try {
      await authApi.logout();
    } catch {
      // Even if the request fails, clear the session in the UI.
    }
    navigate("/", { replace: true });
    dispatch(clearCurrentUser());
    toast.success("Logged out. See you soon!");
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-1.5 rounded-full p-1 pr-2 transition hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <Avatar name={user.name} src={user.avatar?.url} size="sm" />
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

          <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
          <Link to="/home" role="menuitem" onClick={close} className={itemClasses}>
            <House className="size-4 text-slate-500" /> Home
          </Link>
          <Link to="/settings" role="menuitem" onClick={close} className={itemClasses}>
            <Settings className="size-4 text-slate-500" /> Settings
          </Link>
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
