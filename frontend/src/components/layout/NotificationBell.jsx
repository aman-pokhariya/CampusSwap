import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  Ban,
  Bell,
  BellOff,
  Bookmark,
  CalendarCheck,
  CalendarClock,
  CheckCheck,
  CircleX,
  Clock,
  HandCoins,
  Handshake,
  PackageCheck,
  Repeat,
  ShieldAlert,
  ShieldCheck,
  Star,
  Timer,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import CountBadge from "../ui/CountBadge";
import Skeleton from "../ui/Skeleton";
import {
  useGetNotificationsInfiniteQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
} from "../../api/chat.api";
import { useClickOutside } from "../../hooks/useClickOutside";
import { timeAgo } from "../../utils/format";

const BRAND = "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400";
const AMBER = "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400";
const EMERALD = "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400";
const ROSE = "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400";
const SLATE = "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400";
const VIOLET = "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400";

// Icon and colour for each notification type (backend NOTIFICATION_TYPES).
const STYLES = {
  offer_received: [HandCoins, AMBER],
  offer_countered: [HandCoins, AMBER],
  offer_accepted: [Handshake, EMERALD],
  offer_declined: [CircleX, ROSE],
  offer_withdrawn: [Undo2, SLATE],
  offer_cancelled: [Ban, SLATE],
  offer_expired: [Timer, SLATE],
  deal_meetup_proposed: [CalendarClock, BRAND],
  deal_meetup_confirmed: [CalendarCheck, EMERALD],
  deal_completed: [PackageCheck, EMERALD],
  deal_cancelled: [Ban, ROSE],
  review_received: [Star, AMBER],
  listing_flagged: [ShieldAlert, AMBER],
  listing_restored: [ShieldCheck, EMERALD],
  listing_removed: [ShieldAlert, ROSE],
  listing_expiring: [Clock, AMBER],
  listing_expired: [Clock, SLATE],
  saved_search_match: [Bookmark, BRAND],
  report_resolved: [ShieldCheck, EMERALD],
  account_warning: [TriangleAlert, ROSE],
};

const styleFor = (type) => STYLES[type] ?? (type.startsWith("swap_circle") ? [Repeat, VIOLET] : [Bell, BRAND]);

// A long listing title in quotes would push the end of the sentence (what actually happened, say
// "…was reserved for someone else") out of the clamped lines, so it's shortened here.
const shortenQuotes = (text) => text.replace(/“([^”]{36,})”/g, (_, quoted) => `“${quoted.slice(0, 32).trimEnd()}…”`);

function NotificationRow({ notification, onOpen }) {
  const [Icon, tone] = styleFor(notification.type);

  return (
    <button
      type="button"
      onClick={() => onOpen(notification)}
      className={`flex w-full gap-3 px-4 py-3 text-left transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500 dark:hover:bg-slate-800/60 ${
        notification.read ? "" : "bg-brand-50/50 dark:bg-brand-500/5"
      }`}
    >
      <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${tone}`}>
        <Icon className="size-4" aria-hidden />
      </span>
      {/* Title and body are clamped separately: a long title can't use up the body's lines. */}
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span
            className={`line-clamp-2 min-w-0 text-sm [overflow-wrap:anywhere] ${
              notification.read ? "font-medium text-slate-700 dark:text-slate-200" : "font-bold"
            }`}
          >
            {shortenQuotes(notification.title)}
          </span>
          {!notification.read && (
            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-500">
              <span className="sr-only">Unread</span>
            </span>
          )}
        </span>
        {notification.body && (
          <span className="mt-0.5 line-clamp-3 text-xs text-slate-500 [overflow-wrap:anywhere] dark:text-slate-400">
            {shortenQuotes(notification.body)}
          </span>
        )}
        <span className="mt-1 block text-[11px] text-slate-500 dark:text-slate-400">{timeAgo(notification.createdAt)}</span>
      </span>
    </button>
  );
}

// The bell in the navbar. Its count comes from the server and from live notification:new events
// (socket/SocketManager.jsx). On phones the panel is as wide as the screen minus its margins.
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const bellRef = useRef(null);
  const navigate = useNavigate();
  const count = useSelector((state) => state.chat.unread.notifications);

  const close = useCallback(() => setOpen(false), []);
  // Escape (or a click elsewhere) while focus is in the panel: its buttons are about to disappear, so
  // focus goes back to the bell. (Opening a notification navigates instead, so it just closes.)
  const dismiss = useCallback(() => {
    const hadFocus = menuRef.current?.contains(document.activeElement);
    setOpen(false);
    if (hadFocus) bellRef.current?.focus();
  }, []);
  useClickOutside(menuRef, dismiss, open);

  const { data, isLoading, isError, refetch, hasNextPage, fetchNextPage, isFetchingNextPage, isFetchNextPageError } =
    useGetNotificationsInfiniteQuery();
  const [markRead] = useMarkNotificationReadMutation();
  const [markAllRead, { isLoading: markingAll }] = useMarkAllNotificationsReadMutation();

  // A repeated notification moves to the top, so show each one once.
  const notifications = useMemo(() => {
    const seen = new Set();
    return (data?.pages ?? []).flatMap((page) => page.notifications).filter((n) => !seen.has(n._id) && seen.add(n._id));
  }, [data]);

  const openNotification = (notification) => {
    close();
    if (!notification.read) markRead(notification._id);
    if (notification.link) navigate(notification.link);
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        ref={bellRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications"}
        className="relative grid size-10 place-items-center rounded-xl text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
      >
        <Bell className="size-5" />
        <CountBadge count={count} className="absolute -top-0.5 -right-0.5" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="fixed top-[4.5rem] right-4 left-4 ml-auto max-w-96 origin-top-right animate-fade-up overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 sm:absolute sm:top-full sm:right-0 sm:left-auto sm:mt-2 sm:w-96 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/40"
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <h2 className="font-bold">Notifications</h2>
            {count > 0 && (
              <button
                type="button"
                onClick={() => markAllRead()}
                disabled={markingAll}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-brand-600 transition hover:bg-brand-50 disabled:opacity-60 dark:text-brand-400 dark:hover:bg-brand-500/10"
              >
                <CheckCheck className="size-4" /> Mark all read
              </button>
            )}
          </div>

          {/* Phones: also leaves room for the tab bar, which is drawn on top of this panel. */}
          <div className="max-h-[min(28rem,calc(100dvh-12.5rem-env(safe-area-inset-bottom)))] overflow-y-auto overscroll-contain md:max-h-[min(28rem,calc(100dvh-8rem))]">
            {isLoading ? (
              <div className="space-y-4 p-4" aria-hidden>
                {[1, 2, 3].map((n) => (
                  <div key={n} className="flex gap-3">
                    <Skeleton className="size-9 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : isError && !data ? (
              <div className="px-6 py-10 text-center text-sm">
                <p className="font-semibold">Couldn't load notifications</p>
                <button type="button" onClick={refetch} className="mt-2 font-semibold text-brand-600 hover:underline dark:text-brand-400">
                  Try again
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <BellOff className="mx-auto size-8 text-slate-300 dark:text-slate-600" aria-hidden />
                <p className="mt-3 font-semibold">You're all caught up</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Offers, deals and news about your listings show up here.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {notifications.map((notification) => (
                  <li key={notification._id}>
                    <NotificationRow notification={notification} onOpen={openNotification} />
                  </li>
                ))}
              </ul>
            )}

            {hasNextPage &&
              (isFetchNextPageError ? (
                <p className="flex items-center justify-center gap-1.5 border-t border-slate-100 px-4 py-3 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  Couldn't load more ·
                  <button type="button" onClick={() => fetchNextPage()} className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
                    Retry
                  </button>
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="w-full border-t border-slate-100 px-4 py-3 text-sm font-semibold text-brand-600 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-800 dark:text-brand-400 dark:hover:bg-slate-800/60"
                >
                  {isFetchingNextPage ? "Loading…" : "Show older"}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
