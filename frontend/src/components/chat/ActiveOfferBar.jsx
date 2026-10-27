import { HandCoins } from "lucide-react";
import { useNow } from "../../hooks/useNow";
import { describeTerms, offerActionsFor, offerStatus, timeLeft } from "../../utils/chat";

// The offer waiting for a reply, pinned under the header: in a long chat its card may be far up.
// Only a summary: tapping it scrolls to the card (onView), so its buttons are never on screen twice.
export default function ActiveOfferBar({ conversation, myId, onView }) {
  const offer = conversation.activeOffer;
  const now = useNow(30000);
  if (!offer || offerStatus(offer, now) !== "pending") return null;

  const { listing, myDealRole, otherUser } = conversation;
  const { canRespond } = offerActionsFor(offer, { myId, myDealRole }, now);
  const what = listing.type === "free" ? "Pickup request" : listing.type === "swap" ? `Swap: ${offer.note}` : `Offer: ${describeTerms(offer, listing)}`;
  const firstName = otherUser.name.split(" ")[0];

  return (
    <div className="border-b border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-950/40">
      <button
        type="button"
        onClick={() => onView(offer._id)}
        className="flex w-full items-center gap-3 px-4 py-2 text-left text-amber-900 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-amber-500 dark:text-amber-100"
      >
        <HandCoins className="size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
        {/* The terms can be long (a swap note): they get one line, and whose turn it is always shows in full. */}
        <span className="min-w-0 flex-1">
          <strong className="block truncate text-sm">{what}</strong>
          <span className="block text-xs text-amber-800/80 dark:text-amber-200/80">
            {canRespond ? "Your turn to reply" : `Waiting for ${firstName}`} · {timeLeft(offer.expiresAt, now)}
          </span>
        </span>
        <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/30">
          View
        </span>
      </button>
    </div>
  );
}
