import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import { ArrowLeft, CircleX, MessageCircle, PartyPopper, RefreshCw, SearchX, ShieldCheck, Star } from "lucide-react";
import DealStepper from "../../components/deals/DealStepper";
import MeetupCard from "../../components/deals/MeetupCard";
import HandoverCard from "../../components/deals/HandoverCard";
import ReviewCard from "../../components/deals/ReviewCard";
import CancelDealDialog from "../../components/deals/CancelDealDialog";
import TypeBadge from "../../components/listings/TypeBadge";
import { TypeVisual } from "../../components/listings/ListingCard";
import TrustRing from "../../components/trust/TrustRing";
import StarRating from "../../components/trust/StarRating";
import Alert from "../../components/ui/Alert";
import Avatar from "../../components/ui/Avatar";
import Button, { buttonClasses } from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import Skeleton from "../../components/ui/Skeleton";
import { useGetDealQuery } from "../../api/deals.api";
import { useGetConversationQuery } from "../../api/chat.api";
import { setActiveDeal } from "../../redux/chatSlice";
import { useGoBack } from "../../hooks/useGoBack";
import { CANCEL_REASON_MAP } from "../../constants/deals";
import {
  cancelReasonPhrase,
  counterpartLabel,
  dealNews,
  dealToastId,
  firstName,
  formatDealAmount,
  formatDealDate,
  isListingOwner,
  isOpenStatus,
  nextStepHint,
  roleLabel,
} from "../../utils/deals";
import { imageUrl } from "../../utils/image";

const card = "rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900";

const HINT_TONES = {
  action: "text-brand-700 dark:text-brand-300",
  waiting: "text-slate-600 dark:text-slate-300",
  warning: "text-amber-700 dark:text-amber-300",
  done: "text-emerald-700 dark:text-emerald-300",
  muted: "text-slate-500 dark:text-slate-400",
};

// Where each paper bit starts, how long it waits and its colour (fixed, so every render is the same).
const CONFETTI = [
  ["6%", "0ms", "bg-emerald-400"],
  ["14%", "120ms", "bg-amber-400"],
  ["23%", "40ms", "bg-brand-500"],
  ["31%", "200ms", "bg-fuchsia-500"],
  ["40%", "80ms", "bg-sky-400"],
  ["48%", "260ms", "bg-rose-400"],
  ["56%", "20ms", "bg-emerald-500"],
  ["64%", "160ms", "bg-amber-300"],
  ["72%", "60ms", "bg-violet-500"],
  ["80%", "220ms", "bg-sky-500"],
  ["88%", "100ms", "bg-rose-500"],
  ["95%", "180ms", "bg-brand-400"],
];

function Confetti() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-56 overflow-hidden">
      {CONFETTI.map(([left, delay, color], index) => (
        <span
          key={left}
          className={`absolute top-0 animate-confetti rounded-sm ${color} ${index % 2 ? "h-3 w-1.5" : "size-2"}`}
          style={{ left, animationDelay: delay }}
        />
      ))}
    </div>
  );
}

function DealSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-6" role="status" aria-label="Loading deal">
      <Skeleton className="h-5 w-16" />
      <div className={`${card} space-y-5`}>
        <div className="flex gap-4">
          <Skeleton className="size-24 shrink-0 rounded-2xl" />
          <div className="flex-1 space-y-2.5 py-1">
            <Skeleton className="h-5 w-28 rounded-full" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-5 w-24" />
          </div>
        </div>
        <Skeleton className="h-14 rounded-2xl" />
        <Skeleton className="h-16 rounded-2xl" />
      </div>
      <Skeleton className="h-64 rounded-3xl" />
    </div>
  );
}

// What, how much, with whom, and the three steps.
function DealHeader({ deal, myId, rentPeriod }) {
  const other = deal.otherUser;
  const hint = nextStepHint(deal, myId);
  // Visitors get a 404 for a listing under review; its owner can still open it.
  const listingLink = deal.listing?._id && (!deal.listing.hidden || isListingOwner(deal)) ? `/listings/${deal.listing._id}` : null;
  const chatLink = deal.conversationId && deal.role !== "viewer" ? `/inbox/${deal.conversationId}` : null;

  return (
    <section className={card}>
      <div className="flex gap-4">
        <div className="size-20 shrink-0 overflow-hidden rounded-2xl bg-slate-100 sm:size-24 dark:bg-slate-800">
          {deal.cover ? (
            <img src={imageUrl(deal.cover, { width: 192, height: 192 })} alt="" className="size-full object-cover" />
          ) : (
            <TypeVisual type={deal.listingType} className="size-full [&_span]:hidden [&_svg]:size-8" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <TypeBadge type={deal.listingType} />
            <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
              {roleLabel(deal)}
            </span>
          </div>
          <h1 className="mt-2 text-xl font-extrabold tracking-tight text-balance [overflow-wrap:anywhere] sm:text-2xl">{deal.title}</h1>
          <p className="mt-0.5 text-lg font-extrabold text-slate-700 dark:text-slate-200">{formatDealAmount(deal, rentPeriod)}</p>
          {listingLink && (
            <Link to={listingLink} className="-mb-1 inline-block py-1 text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400">
              View listing
            </Link>
          )}
        </div>
      </div>

      <DealStepper deal={deal} className="mt-6" />
      <p className={`mt-4 text-center text-sm font-semibold ${HINT_TONES[hint.tone]}`}>{hint.text}</p>

      {/* On phones the person gets a line of their own (a squeezed name and rating ran under the ring),
          with the trust ring and Chat below. */}
      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
        {other ? (
          <Link
            to={`/u/${other._id}`}
            className="flex min-w-0 basis-full items-center gap-3 rounded-xl p-1 hover:bg-white focus-visible:outline-2 focus-visible:outline-brand-500 sm:basis-0 sm:grow dark:hover:bg-slate-800"
          >
            <Avatar name={other.name} src={other.avatar?.url} />
            <span className="min-w-0">
              <span className="block truncate font-bold">{other.name}</span>
              <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                {counterpartLabel(deal)} · {other.hostel || "On campus"}
              </span>
              {other.trust?.ratingCount > 0 && (
                <StarRating value={other.trust.ratingAvg} count={other.trust.ratingCount} size="sm" className="mt-0.5" />
              )}
            </span>
          </Link>
        ) : (
          <p className="flex-1 p-1 text-sm text-slate-500 dark:text-slate-400">This account no longer exists.</p>
        )}
        {other && <TrustRing trust={other.trust} size="md" />}
        {chatLink && (
          <Link to={chatLink} className={buttonClasses({ variant: "secondary", size: "sm", className: "ml-auto" })}>
            <MessageCircle className="size-4" /> Chat
          </Link>
        )}
      </div>
    </section>
  );
}

// The handover is done. With `celebrate` (it happened while this page was open) there's confetti,
// and focus moves here, since the code boxes or QR that had it are gone.
function CompletedCard({ deal, celebrate, onReview }) {
  const headingRef = useRef(null);
  const other = firstName(deal.otherUser?.name);
  const canReview = deal.role !== "viewer" && !deal.reviews?.mine;

  useEffect(() => {
    if (celebrate) headingRef.current?.focus();
  }, [celebrate]);

  const when = deal.completedAt ? ` on ${formatDealDate(deal.completedAt)}` : "";
  const what =
    deal.role === "seller"
      ? `You handed over “${deal.title}” to ${other}${when}.`
      : deal.role === "buyer"
        ? `You got “${deal.title}” from ${other}${when}.`
        : `“${deal.title}” was handed over${when}.`;

  return (
    <section
      role={celebrate ? "status" : undefined}
      className="relative overflow-hidden rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-center sm:p-8 dark:border-emerald-500/30 dark:bg-emerald-500/10"
    >
      {celebrate && <Confetti />}
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
        <PartyPopper className="size-7" aria-hidden />
      </span>
      <h2 ref={headingRef} tabIndex={-1} className="mt-4 text-xl font-extrabold text-emerald-950 outline-none dark:text-emerald-50">
        {celebrate ? "Deal completed 🎉" : "Handed over 🎉"}
      </h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-emerald-900/80 dark:text-emerald-100/80">
        {what}
      </p>
      {canReview && (
        <Button variant="gradient" onClick={onReview} className="mt-5">
          <Star className="size-4" /> Leave a review
        </Button>
      )}
    </section>
  );
}

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

// Who cancelled, why, and the note they left (an admin sees the reason as it was picked).
function CancelledCard({ deal, myId }) {
  const viewer = deal.role === "viewer";
  const byMe = deal.cancelledBy === myId;
  const other = firstName(deal.otherUser?.name);
  let who = "This deal was cancelled";
  if (!viewer && deal.cancelledBy) who = byMe ? "You cancelled this deal" : `${other} cancelled this deal`;
  const picked = CANCEL_REASON_MAP[deal.cancelReason]?.label;
  const phrase = cancelReasonPhrase(deal.cancelReason, { mine: byMe });
  const reason = viewer ? picked && `Reason: “${picked}”` : phrase && capitalize(phrase);

  return (
    <section className={card}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
          <CircleX className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold">{who}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {reason}
            {reason && deal.cancelledAt && " · "}
            {deal.cancelledAt && formatDealDate(deal.cancelledAt)}
          </p>
        </div>
      </div>
      {deal.cancelNote && (
        <blockquote className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700 [overflow-wrap:anywhere] dark:bg-slate-800/70 dark:text-slate-200">
          “{deal.cancelNote}”
        </blockquote>
      )}
      {/* Only while the listing is up for grabs: not once a moderator removed it (which also cancels its
          deal), while it's under review, after it was deleted or expired, or once it went to someone else. */}
      {!viewer && deal.listing?.status === "active" && !deal.listing.hidden && (
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          {deal.role === "seller"
            ? "Your listing went back on CampusSwap, so other students can make offers again."
            : "The listing went back on CampusSwap. Still interested? You can make a new offer in the chat."}
        </p>
      )}
    </section>
  );
}

function SafetyTips() {
  return (
    <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-500/30 dark:bg-emerald-500/10">
      <h2 className="flex items-center gap-2 font-bold text-emerald-900 dark:text-emerald-100">
        <ShieldCheck className="size-5" aria-hidden /> Stay safe
      </h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-emerald-900/80 dark:text-emerald-100/80">
        <li>Meet at the safe spot in daylight, and bring a friend if you like.</li>
        <li>Check the item before any money changes hands.</li>
        <li>The handover code completes the deal: only share or enter it once you have the item.</li>
      </ul>
    </section>
  );
}

// /deals/:id. Every deal gets a fresh screen (forms, dialogs, the celebration).
export default function DealDetail() {
  const { id } = useParams();
  return <DealScreen key={id} dealId={id} />;
}

function DealScreen({ dealId }) {
  // Came from inside the app → go back there; a shared link → the deals list.
  const goBack = useGoBack("/deals");
  const dispatch = useDispatch();
  const me = useSelector((state) => state.auth.user);
  const { data, isLoading, isError, error, refetch, isFetching } = useGetDealQuery(dealId);
  const deal = data?.deal;
  const participant = Boolean(deal) && deal.role !== "viewer";
  // The chat says whether the two are blocked, and the rent period ("3 days") the deal itself doesn't.
  const { data: chatData } = useGetConversationQuery(deal?.conversationId, { skip: !participant || !deal?.conversationId });
  const chat = chatData?.conversation;

  const [cancelOpen, setCancelOpen] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const reviewRef = useRef(null);

  // News about this deal shows right here, so the socket handlers skip its toasts (and the one that
  // may still be up goes away).
  useEffect(() => {
    dispatch(setActiveDeal(dealId));
    toast.dismiss(dealToastId(dealId));
    return () => dispatch(setActiveDeal(null));
  }, [dispatch, dealId]);

  // Live changes: a handover that completes while the page is open gets the celebration, and screen
  // readers hear what the other person did (the page has no toasts for it).
  const previous = useRef(null);
  useEffect(() => {
    if (!deal) return;
    const before = previous.current;
    previous.current = deal;
    if (!before) return;
    if (isOpenStatus(before.status) && deal.status === "completed") setJustCompleted(true);
    const news = dealNews(before, deal, me._id);
    if (news) setAnnouncement(`${news.title}. ${news.description}`);
  }, [deal, me._id]);

  const jumpToReview = () => {
    const section = reviewRef.current;
    if (!section) return;
    section.scrollIntoView({ behavior: "smooth", block: "start" });
    section.querySelector("input")?.focus({ preventScroll: true });
  };

  if (isLoading) return <DealSkeleton />;

  // A failed background refetch keeps what's on screen; only nothing at all is an error.
  if (isError && !data) {
    const missing = error?.status === 404;
    return (
      <EmptyState
        icon={SearchX}
        title={missing ? "Deal not found" : "Couldn't load this deal"}
        description={missing ? "It doesn't exist, or it isn't one of yours." : error?.message}
        action={
          missing ? (
            <Link to="/deals" className={buttonClasses({ variant: "secondary" })}>
              Back to deals
            </Link>
          ) : (
            <Button variant="secondary" onClick={refetch} loading={isFetching}>
              <RefreshCw className="size-4" /> Try again
            </Button>
          )
        }
      />
    );
  }

  const open = isOpenStatus(deal.status);
  const readOnly = deal.role === "viewer";
  const blocked = Boolean(chat?.blocked);

  return (
    <div className="mx-auto max-w-3xl animate-fade-up space-y-6">
      {/* The invisible ::after box gives thumbs a 44px-tall target without moving anything. */}
      <button
        type="button"
        onClick={goBack}
        className="relative inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 after:absolute after:-inset-x-2 after:-inset-y-3 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
      >
        <ArrowLeft className="size-4" /> Back
      </button>

      <DealHeader deal={deal} myId={me._id} rentPeriod={chat?.listing.rentPeriod} />

      {readOnly && (
        <Alert type="info" title="Admin view">
          You're looking at this deal as a campus admin. Only the buyer and the seller can change it.
        </Alert>
      )}
      {open && deal.listing?.hidden && (
        <Alert type="warning" title="This listing is under review — you can still cancel">
          Meetups and the handover wait until a moderator has checked it.
        </Alert>
      )}

      {open && (
        <>
          <MeetupCard deal={deal} myId={me._id} safeSpots={me.campus?.safeSpots ?? []} blocked={blocked} readOnly={readOnly} />
          {!readOnly && <HandoverCard deal={deal} />}
          {!readOnly && (
            <section className="flex flex-col gap-3 rounded-3xl border border-dashed border-slate-300 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700">
              <div>
                <h2 className="font-semibold">Plans changed?</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">You can cancel any time before the handover.</p>
              </div>
              <Button variant="danger-ghost" onClick={() => setCancelOpen(true)} className="shrink-0">
                <CircleX className="size-4" /> Cancel deal
              </Button>
            </section>
          )}
          {!readOnly && <SafetyTips />}
        </>
      )}

      {deal.status === "completed" && (
        <>
          <CompletedCard deal={deal} celebrate={justCompleted} onReview={jumpToReview} />
          {!readOnly && <ReviewCard ref={reviewRef} deal={deal} />}
        </>
      )}

      {deal.status === "cancelled" && <CancelledCard deal={deal} myId={me._id} />}

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      {/* Stays mounted, so it closes properly if the deal ends while it's open (say, the other person
          cancels first). */}
      {!readOnly && <CancelDealDialog open={cancelOpen && open} deal={deal} blocked={blocked} onClose={() => setCancelOpen(false)} />}
    </div>
  );
}
