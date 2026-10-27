import { Link } from "react-router-dom";
import { Ban, CalendarCheck, CircleX, HandCoins, Handshake, Info, MapPin, PackageCheck, Tag, Timer, Trash, Undo2 } from "lucide-react";
import { formatClock, systemText } from "../../utils/chat";

const ICONS = {
  offer_countered: HandCoins,
  offer_accepted: Handshake,
  offer_declined: CircleX,
  offer_withdrawn: Undo2,
  offer_cancelled: Ban,
  offer_expired: Timer,
  deal_meetup_proposed: MapPin,
  deal_meetup_confirmed: CalendarCheck,
  deal_completed: PackageCheck,
  deal_cancelled: Ban,
  listing_sold: Tag,
  listing_deleted: Trash,
};

const HAPPY_EVENTS = ["offer_accepted", "deal_meetup_confirmed", "deal_completed"];

// "Riya countered with ₹300", "You proposed a meetup: Library Gate, Tue, 5 Nov, 5:30 pm": centred,
// between the bubbles. Every step of a deal links to the deal page, where the next step happens.
// `role` is my side of the chat ("owner" | "visitor"): some events read differently for each.
export default function SystemMessage({ message, myId, otherName, listing, role }) {
  const { event, data } = message.system ?? {};
  const Icon = ICONS[event] ?? Info;
  const dealId = event === "offer_accepted" || event?.startsWith("deal_") ? data?.dealId : null;
  // The note left with a cancellation (never there between people who blocked each other).
  const note = event === "deal_cancelled" ? data?.note : null;

  return (
    <div className="flex justify-center px-2 py-1.5">
      <p
        className={`inline-flex max-w-md flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 rounded-2xl px-3 py-1.5 text-center text-xs font-medium ${
          HAPPY_EVENTS.includes(event)
            ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/30"
            : "bg-slate-200/70 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
        }`}
      >
        <Icon className="size-3.5 shrink-0" aria-hidden />
        {/* Swap notes are free text: a long word or link wraps instead of widening the chat. */}
        <span className="min-w-0 [overflow-wrap:anywhere]">{systemText(message, { myId, otherName, listing, role })}</span>
        {dealId && (
          <Link to={`/deals/${dealId}`} className="font-bold underline underline-offset-2">
            View deal
          </Link>
        )}
        <time dateTime={message.createdAt} className="text-[10px] font-normal">
          {formatClock(message.createdAt)}
        </time>
        {note && <span className="basis-full font-normal italic [overflow-wrap:anywhere]">“{note}”</span>}
      </p>
    </div>
  );
}
