import { NavLink } from "react-router-dom";
import { useSelector } from "react-redux";
import Avatar from "../ui/Avatar";
import Skeleton from "../ui/Skeleton";
import { TypeVisual } from "../listings/ListingCard";
import OnlineDot from "./OnlineDot";
import { DEAL_LABELS, listTime } from "../../utils/chat";
import { imageUrl } from "../../utils/image";

const previewText = (lastMessage, myId) => {
  const mine = lastMessage.sender === myId && lastMessage.type !== "system";
  return mine ? `You: ${lastMessage.text}` : lastMessage.text;
};

// One row of the inbox: who, what about, the latest message, and whether it needs me.
// A chat I opened without writing anything yet (say "Make offer" on a listing, then Cancel) shows as
// a quiet draft rather than an empty state. Only its visitor ever sees it: the owner's inbox skips it.
export default function ConversationItem({ conversation, myId, search = "" }) {
  const { _id, otherUser, listing, lastMessage, lastMessageAt, unreadCount, activeOffer, deal } = conversation;
  const online = useSelector((state) => state.chat.presence[otherUser._id]?.online);
  const typing = useSelector((state) => Boolean(state.chat.typing[_id]));
  const unread = unreadCount > 0;
  const draft = !lastMessage;

  return (
    <NavLink
      to={{ pathname: `/inbox/${_id}`, search }}
      className={({ isActive }) =>
        `flex gap-3 rounded-2xl p-3 transition focus-visible:outline-2 focus-visible:outline-brand-500 ${
          isActive ? "bg-brand-50 dark:bg-brand-500/10" : "hover:bg-slate-100 dark:hover:bg-slate-800/60"
        }`
      }
    >
      <span className="relative shrink-0 self-start">
        <Avatar name={otherUser.name} src={otherUser.avatar?.url} size="lg" />
        {online && <OnlineDot className="absolute right-0 bottom-0 size-3.5" />}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={`truncate ${unread ? "font-extrabold" : "font-semibold"}`}>{otherUser.name}</span>
          <time
            dateTime={lastMessageAt}
            className={`shrink-0 text-xs ${unread ? "font-bold text-brand-600 dark:text-brand-400" : "text-slate-500 dark:text-slate-400"}`}
          >
            {listTime(lastMessageAt)}
          </time>
        </span>

        <span className="mt-0.5 flex items-center justify-between gap-2">
          <span
            className={`truncate text-sm ${
              typing
                ? "font-semibold text-emerald-600 dark:text-emerald-400"
                : draft
                  ? "text-slate-500 italic dark:text-slate-400"
                  : unread
                    ? "font-semibold text-slate-900 dark:text-white"
                    : "text-slate-500 dark:text-slate-400"
            }`}
          >
            {typing ? "typing…" : draft ? "Say hi to start the chat" : previewText(lastMessage, myId)}
          </span>
          {unread && (
            <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-brand-600 px-1.5 text-[11px] font-bold text-white dark:bg-brand-500">
              {unreadCount > 99 ? "99+" : unreadCount}
              <span className="sr-only"> unread</span>
            </span>
          )}
        </span>

        <span className="mt-1.5 flex items-center gap-1.5">
          <span className="size-5 shrink-0 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
            {listing.cover ? (
              <img src={imageUrl(listing.cover, { width: 40, height: 40 })} alt="" className="size-full object-cover" />
            ) : (
              listing.type && <TypeVisual type={listing.type} className="size-full [&_span]:hidden [&_svg]:size-3" />
            )}
          </span>
          <span className={`truncate text-xs text-slate-500 dark:text-slate-400 ${listing.deleted ? "line-through" : ""}`}>{listing.title}</span>
          {activeOffer && (
            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 uppercase dark:bg-amber-500/15 dark:text-amber-300">
              Offer
            </span>
          )}
          {deal && (
            <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 uppercase dark:bg-emerald-500/15 dark:text-emerald-300">
              {DEAL_LABELS[deal.status] ?? "Deal"}
            </span>
          )}
        </span>
      </span>
    </NavLink>
  );
}

export function ConversationItemSkeleton() {
  return (
    <div className="flex gap-3 p-3">
      <Skeleton className="size-14 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2 py-1">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-3.5 w-4/5" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}
