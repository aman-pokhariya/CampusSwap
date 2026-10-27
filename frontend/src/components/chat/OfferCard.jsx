import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, ChevronDown, Gift, HandCoins, Handshake, Repeat, Search, Timer } from "lucide-react";
import Button from "../ui/Button";
import ConfirmDialog from "../ui/ConfirmDialog";
import { useRespondToOfferMutation } from "../../api/chat.api";
import { useNow } from "../../hooks/useNow";
import { formatRupees } from "../../utils/format";
import {
  canMakeOffer,
  cancelReasonText,
  describeTerms,
  listTime,
  offerActionsFor,
  offerStatus,
  periodWord,
  timeLeft,
} from "../../utils/chat";

const MUTED = "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
const STATUS_STYLES = {
  pending: { label: "Pending", classes: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  accepted: { label: "Accepted", classes: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  declined: { label: "Declined", classes: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
  withdrawn: { label: "Withdrawn", classes: MUTED },
  cancelled: { label: "Cancelled", classes: MUTED },
  expired: { label: "Expired", classes: MUTED },
};

const KINDS = {
  free: { label: "Request", icon: Gift },
  swap: { label: "Swap offer", icon: Repeat },
  wanted: { label: "Offer", icon: Search },
};

const firstName = (name = "") => name.split(" ")[0] || "They";

// One step of the negotiation, as a sentence. `role` is my side of the chat (owner/visitor).
const historyLine = (entry, { who, listing, role }) => {
  const isRequest = listing.type === "free";
  switch (entry.action) {
    case "offered":
      return isRequest ? `${who} asked for it` : `${who} offered ${describeTerms(entry, listing)}`;
    case "countered":
      return isRequest ? `${who} replied` : `${who} countered with ${describeTerms(entry, listing)}`;
    case "accepted":
      return `${who} accepted`;
    case "declined":
      return `${who} declined`;
    case "withdrawn":
      return `${who} withdrew it`;
    case "cancelled":
      return `Cancelled: ${cancelReasonText(entry.reason, { type: listing.type, role })}`;
    case "expired":
      return "Expired without a reply";
    default:
      return entry.action;
  }
};

function Terms({ offer, listing }) {
  if (listing.type === "free") {
    return <p className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">Free · pickup request</p>;
  }
  if (listing.type === "swap") {
    return (
      <div>
        <p className="text-base font-bold [overflow-wrap:anywhere]">{offer.note}</p>
        {offer.amount > 0 && <p className="text-sm text-slate-600 dark:text-slate-300">+ {formatRupees(offer.amount)} cash</p>}
      </div>
    );
  }
  if (listing.type === "rent") {
    return (
      <div>
        <p className="text-2xl font-extrabold">
          {formatRupees(offer.amount)}
          <span className="text-base font-semibold text-slate-500 dark:text-slate-400">/{periodWord(listing.rentPeriod)}</span>
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          × {offer.periods} {periodWord(listing.rentPeriod, offer.periods)} ={" "}
          <strong className="text-slate-900 dark:text-white">{formatRupees(offer.total)}</strong>
        </p>
      </div>
    );
  }
  return <p className="text-2xl font-extrabold">{formatRupees(offer.amount)}</p>;
}

// An offer in the chat, always showing its latest state (offer:update keeps it fresh). Whoever's turn
// it is can accept, counter or decline; whoever made the latest proposal can withdraw it.
// `data-offer-id` lets the pinned offer bar find the card and scroll to it (MessageList).
export default function OfferCard({ offer, conversation, myId, onCounter, className = "" }) {
  const { listing, myDealRole, otherUser, role } = conversation;
  const otherFirst = firstName(otherUser.name);
  // Only a pending offer can run out (and then show as expired), so only it needs a ticking clock.
  const now = useNow(offer.status === "pending" ? 30000 : null);
  const status = offerStatus(offer, now);
  const { canRespond, canWithdraw } = offerActionsFor(offer, { myId, myDealRole }, now);
  // Accepting or countering needs the listing to still be up for grabs; declining never does.
  const available = canMakeOffer(conversation);

  const [respond] = useRespondToOfferMutation();
  const [busy, setBusy] = useState(null); // the action being sent
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Accept, decline and withdraw remove the very button they came from. Once the offer has changed,
  // focus moves to the card (which now says what happened) instead of dropping to the top of the page.
  const cardRef = useRef(null);
  const refocus = useRef(false);
  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    cardRef.current?.focus();
  }, [status, offer.awaiting]);

  const kind = KINDS[listing.type] ?? { label: "Offer", icon: HandCoins };
  const KindIcon = kind.icon;
  const whoOf = (id) => (id === myId ? "You" : otherFirst);
  const countered = offer.history.some((entry) => entry.action === "countered");
  // A free item is asked for by the buyer (or offered by its owner), and the answer is a reply.
  const isRequest = listing.type === "free";
  const proposed = countered ? (isRequest ? "replied" : "countered") : isRequest && offer.proposedBy === offer.buyer ? "asked" : "offered";
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  const lastEntry = offer.history.at(-1);

  const send = async (action) => {
    setBusy(action);
    refocus.current = true;
    try {
      const result = await respond({ offerId: offer._id, conversationId: conversation._id, action }).unwrap();
      toast.success(result.message);
      setConfirmOpen(false);
    } catch (err) {
      refocus.current = false;
      // Close "Accept?" first: toasts are drawn underneath an open dialog.
      if (action === "accept") setConfirmOpen(false);
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  // The counter form gives focus back to whatever had it when it opened. That's the card rather than
  // the Counter button, which is gone once the counter is sent.
  const counter = () => {
    cardRef.current?.focus();
    onCounter(offer);
  };

  const acceptTitle =
    isRequest
      ? myDealRole === "seller"
        ? `Give it to ${otherFirst}?`
        : "Accept and make it a deal?"
      : listing.type === "swap"
        ? "Accept this swap?"
        : `Accept ${describeTerms(offer, listing)}?`;

  return (
    <div
      ref={cardRef}
      tabIndex={-1}
      data-offer-id={offer._id}
      className={`w-full max-w-sm rounded-2xl border bg-white p-4 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:bg-slate-900 ${
        status === "pending" ? "border-amber-200 dark:border-amber-500/30" : "border-slate-200 dark:border-slate-800"
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-bold">
          <span className="grid size-7 place-items-center rounded-lg bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            <KindIcon className="size-4" />
          </span>
          {kind.label}
        </p>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${style.classes}`}>{style.label}</span>
      </div>

      <div className="mt-3">
        <Terms offer={offer} listing={listing} />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {whoOf(offer.proposedBy)} {proposed} · {listTime(offer.updatedAt)}
        </p>
      </div>

      {offer.note && listing.type !== "swap" && (
        <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700 [overflow-wrap:anywhere] dark:bg-slate-800/70 dark:text-slate-200">
          “{offer.note}”
        </p>
      )}

      {status === "pending" && (
        <p
          className={`mt-3 flex items-center gap-1.5 text-xs font-semibold ${
            canRespond ? "text-amber-700 dark:text-amber-300" : "text-slate-500 dark:text-slate-400"
          }`}
        >
          <Timer className="size-3.5" />
          {canRespond ? "Your turn to reply" : `Waiting for ${otherFirst}`} · {timeLeft(offer.expiresAt, now)}
        </p>
      )}

      {status === "accepted" && (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
          <Handshake className="size-4" /> Deal created
          {offer.deal && (
            <Link to={`/deals/${offer.deal}`} className="inline-flex items-center gap-1 text-brand-600 hover:underline dark:text-brand-400">
              View deal <ArrowRight className="size-3.5" />
            </Link>
          )}
        </p>
      )}

      {status === "cancelled" && lastEntry?.reason && (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Cancelled: {cancelReasonText(lastEntry.reason, { type: listing.type, role })}
        </p>
      )}

      {canRespond && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={!available || Boolean(busy)}>
            Accept
          </Button>
          <Button size="sm" variant="secondary" onClick={counter} disabled={!available || Boolean(busy)}>
            {isRequest ? "Reply" : "Counter"}
          </Button>
          <Button size="sm" variant="danger-ghost" onClick={() => send("decline")} loading={busy === "decline"} disabled={Boolean(busy)}>
            Decline
          </Button>
        </div>
      )}
      {canWithdraw && (
        <Button size="sm" variant="secondary" onClick={() => send("withdraw")} loading={busy === "withdraw"} className="mt-4 w-full">
          Withdraw {isRequest ? "request" : "offer"}
        </Button>
      )}
      {canRespond && !available && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">This listing isn't available right now, so the offer can't be accepted.</p>
      )}

      {offer.history.length > 1 && (
        <div className="mt-3 border-t border-slate-100 pt-2 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setHistoryOpen((value) => !value)}
            aria-expanded={historyOpen}
            className="flex w-full items-center justify-between rounded-lg py-1 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          >
            History ({offer.history.length})
            <ChevronDown className={`size-4 transition-transform ${historyOpen ? "rotate-180" : ""}`} />
          </button>
          {historyOpen && (
            <ol className="mt-1 space-y-1.5">
              {offer.history.map((entry, index) => (
                <li key={`${entry.action}-${index}`} className="flex justify-between gap-3 text-xs">
                  <span className="min-w-0 text-slate-700 [overflow-wrap:anywhere] dark:text-slate-300">
                    {historyLine(entry, { who: entry.by ? whoOf(entry.by) : "CampusSwap", listing, role })}
                  </span>
                  <time dateTime={entry.at} className="shrink-0 text-slate-500 dark:text-slate-400">
                    {listTime(entry.at)}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {/* Only while it's still my turn: if the offer closes meanwhile, the question goes with it. */}
      <ConfirmDialog
        open={confirmOpen && canRespond}
        title={acceptTitle}
        description={`It becomes a deal for “${listing.title}”: the listing is reserved for it and any other offers on it are cancelled. Next, you agree on a meetup.`}
        confirmLabel="Accept"
        tone="success"
        icon={Handshake}
        loading={busy === "accept"}
        onConfirm={() => send("accept")}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}
