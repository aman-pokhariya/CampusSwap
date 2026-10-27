import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { ArrowLeft, ChevronRight } from "lucide-react";
import Avatar from "../ui/Avatar";
import OnlineDot from "./OnlineDot";
import { TypeVisual } from "../listings/ListingCard";
import UserActionsMenu from "../trust/UserActionsMenu";
import { usePresence } from "../../hooks/usePresence";
import { useNow } from "../../hooks/useNow";
import { formatPrice, soldLabel } from "../../utils/format";
import { lastSeenLabel } from "../../utils/chat";
import { imageUrl } from "../../utils/image";

const PRICED_TYPES = ["sell", "rent", "kit"];
const AMBER = "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300";
const ROSE = "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300";
const SLATE = "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";

// The listing's state, when it isn't simply for sale. Moderation is only spelled out to its owner:
// the other person just learns that it isn't available.
const listingBadge = (listing, role) => {
  if (listing.deleted) return { label: "Deleted", classes: ROSE };
  if (listing.hidden && role !== "owner") return { label: "Unavailable", classes: SLATE };
  if (listing.removed) return { label: "Removed", classes: ROSE };
  if (listing.hidden) return { label: "Under review", classes: AMBER };
  if (listing.status === "reserved") return { label: "Reserved", classes: AMBER };
  if (listing.status === "sold") return { label: soldLabel(listing.type), classes: SLATE };
  if (listing.status === "expired") return { label: "Expired", classes: SLATE };
  return null;
};

// Who I'm talking to (online / last seen / typing) and what about (the listing and its state), plus
// the ⋮ menu about them: their profile, Report and Block. `blockedByMe`: my own block of them (the
// deal, if any, has its own banner under this header).
export default function ChatHeader({ conversation, blockedByMe = false, onBack }) {
  const { otherUser, listing, role } = conversation;
  const { online, lastSeenAt } = usePresence(otherUser._id, otherUser.lastSeenAt);
  const typing = useSelector((state) => Boolean(state.chat.typing[conversation._id]));
  const connected = useSelector((state) => state.chat.connected);
  useNow(60000); // keeps "Last seen 5m ago" current

  // Phones: the chat opens as a full-screen layer and hides the list row that had focus, so focus
  // starts here, on who the chat is with.
  const personRef = useRef(null);
  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) personRef.current?.focus();
  }, []);

  const status = typing
    ? "typing…"
    : !connected
      ? "Connecting…"
      : online
        ? "Online"
        : lastSeenLabel(lastSeenAt) || otherUser.hostel || "On campus";
  const badge = listingBadge(listing, role);
  // Visitors get a 404 for hidden listings, so only link where the page will open.
  const listingLink = listing._id && (!listing.hidden || role === "owner") ? `/listings/${listing._id}` : null;
  // A deleted listing only has its snapshot (no price): leave the price line out rather than say ₹0.
  const price = listing.type && (listing.price != null || !PRICED_TYPES.includes(listing.type)) ? formatPrice(listing) : null;

  const listingRow = (
    <>
      <span className="size-10 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
        {listing.cover ? (
          <img src={imageUrl(listing.cover, { width: 80, height: 80 })} alt="" className="size-full object-cover" />
        ) : (
          listing.type && <TypeVisual type={listing.type} className="size-full [&_span]:hidden [&_svg]:size-5" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{listing.title}</span>
        {price && <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{price}</span>}
      </span>
      {badge && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${badge.classes}`}>{badge.label}</span>}
      {listingLink && <ChevronRight className="size-4 shrink-0 text-slate-400" aria-hidden />}
    </>
  );

  // relative z-20: the ⋮ menu opens over the messages, which come later in the page.
  return (
    <header className="relative z-20 border-b border-slate-200 bg-white/90 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90">
      <div className="flex items-center gap-2 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 sm:px-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to chats"
          className="grid size-10 shrink-0 place-items-center rounded-xl text-slate-600 hover:bg-slate-100 md:hidden dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="size-5" />
        </button>
        <Link
          ref={personRef}
          to={`/u/${otherUser._id}`}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-brand-500 dark:hover:bg-slate-800/60"
        >
          <span className="relative shrink-0">
            <Avatar name={otherUser.name} src={otherUser.avatar?.url} />
            {online && <OnlineDot className="absolute right-0 bottom-0 size-3" />}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-bold">{otherUser.name}</span>
            {/* Not a live region: "typing" is announced once, by the message list. */}
            <span
              className={`block truncate text-xs ${
                typing || online ? "font-semibold text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {status}
            </span>
          </span>
        </Link>
        <UserActionsMenu user={otherUser} blockedByMe={blockedByMe} showProfileLink className="shrink-0" />
      </div>

      {listingLink ? (
        <Link to={listingLink} className="flex items-center gap-3 border-t border-slate-100 px-4 py-2 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60">
          {listingRow}
        </Link>
      ) : (
        <div className="flex items-center gap-3 border-t border-slate-100 px-4 py-2 dark:border-slate-800">{listingRow}</div>
      )}
    </header>
  );
}
