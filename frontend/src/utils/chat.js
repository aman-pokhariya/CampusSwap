import { formatMeetupTime, formatRupees, soldLabel } from "./format";
import { CANCEL_REASON_MAP } from "../constants/deals";

// ── Time ──────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;
const clockFormatter = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" });

const startOfDay = (date) => {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
};

const daysAgo = (date) => Math.round((startOfDay(Date.now()) - startOfDay(date)) / DAY_MS);

export const isSameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime();

// "4:05 pm"
export const formatClock = (date) => clockFormatter.format(new Date(date));

// The separator between days in a chat: "Today", "Yesterday", "Monday", "12 Oct", "12 Oct 2025".
export const dayLabel = (date) => {
  const days = daysAgo(date);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  const day = new Date(date);
  if (days < 7) return day.toLocaleDateString("en-IN", { weekday: "long" });
  const thisYear = day.getFullYear() === new Date().getFullYear();
  return day.toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(!thisYear && { year: "numeric" }) });
};

// The time on an inbox row: "4:05 pm" today, then "Yesterday", "Mon", "12 Oct".
export const listTime = (date) => {
  const days = daysAgo(date);
  if (days === 0) return formatClock(date);
  if (days === 1) return "Yesterday";
  const day = new Date(date);
  if (days < 7) return day.toLocaleDateString("en-IN", { weekday: "short" });
  return day.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

export const lastSeenLabel = (date) => {
  if (!date) return "";
  const minutes = (Date.now() - new Date(date).getTime()) / 60000;
  if (minutes < 1) return "Last seen just now";
  if (minutes < 60) return `Last seen ${Math.floor(minutes)}m ago`;
  const days = daysAgo(date);
  if (days === 0) return `Last seen today at ${formatClock(date)}`;
  if (days === 1) return `Last seen yesterday at ${formatClock(date)}`;
  return `Last seen ${dayLabel(date)}`;
};

// "47h left", "3h 20m left", "12m left"
export const timeLeft = (date, now = Date.now()) => {
  const minutes = Math.floor((new Date(date).getTime() - now) / 60000);
  if (minutes < 1) return "less than a minute left";
  if (minutes < 60) return `${minutes}m left`;
  const hours = Math.floor(minutes / 60);
  return hours >= 10 ? `${hours}h left` : `${hours}h ${minutes % 60}m left`;
};

// ── Offers ────────────────────────────────────────────────

const PERIOD_WORDS = { day: "day", week: "week", month: "month" };

// "day" / "days" for a rent period ("period" when the listing is gone).
export const periodWord = (period, count = 1) => {
  const word = PERIOD_WORDS[period] ?? "period";
  return count === 1 ? word : `${word}s`;
};

// An offer in a sentence: "₹350", "₹20/day × 3 days (₹60)", "a swap: my DBMS book", "a request".
export const describeTerms = ({ amount = 0, periods = 1, note = "" }, listing) => {
  switch (listing?.type) {
    case "free":
      return "a request";
    case "swap":
      return amount > 0 ? `a swap (${note}) + ${formatRupees(amount)}` : `a swap: ${note}`;
    case "rent": {
      const period = listing.rentPeriod;
      return `${formatRupees(amount)}/${periodWord(period)} × ${periods} ${periodWord(period, periods)} (${formatRupees(amount * periods)})`;
    }
    default:
      return formatRupees(amount);
  }
};

// A pending offer past its expiry date is already expired, even before the server marks it.
export const offerStatus = (offer, now = Date.now()) =>
  offer.status === "pending" && new Date(offer.expiresAt).getTime() <= now ? "expired" : offer.status;

// awaiting === my role → I can accept, counter or decline. proposedBy === me → I can withdraw.
export const offerActionsFor = (offer, { myId, myDealRole }, now = Date.now()) => {
  const live = offerStatus(offer, now) === "pending";
  return { canRespond: live && offer.awaiting === myDealRole, canWithdraw: live && offer.proposedBy === myId };
};

// ── Chats ─────────────────────────────────────────────────

// The deal chip in a chat and on its inbox row.
export const DEAL_LABELS = {
  agreed: "Deal agreed",
  scheduled: "Meetup set",
  completed: "Deal done",
  cancelled: "Deal cancelled",
};

// Why nobody can write in this chat any more, or null while it's open. Only the owner hears about the
// moderator; the other person just learns the listing is gone. A block never says who blocked whom
// (the chat screen tells the blocker separately, with an Unblock button).
export const chatClosedReason = (conversation) => {
  if (conversation.blocked) return "You can't reply to this conversation.";
  if (conversation.listing.deleted) return "This listing was deleted, so the chat is closed.";
  if (conversation.listing.removed) {
    return conversation.role === "owner"
      ? "A moderator removed this listing, so the chat is closed."
      : "This listing isn't available any more, so the chat is closed.";
  }
  return null;
};

// Offers need a listing that's still up for grabs.
export const canMakeOffer = (conversation) =>
  !chatClosedReason(conversation) && conversation.listing.status === "active" && !conversation.listing.hidden;

// The other person wrote it, or it's a system message I didn't cause: it counts as unread for me.
export const isFromOther = (message, myId) =>
  message.type === "system" ? message.system?.actor !== myId : message.sender !== myId;

// crypto.randomUUID only exists on https and localhost; the LAN dev URL (http://192.168…) needs a fallback.
export const newClientId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// One toast per chat: a new message (or a notification about that chat) updates it instead of
// stacking another, and opening the chat dismisses it.
export const chatToastId = (conversationId) => `msg:${conversationId}`;

const SYSTEM_PREVIEWS = {
  offer_countered: "Counter offer",
  offer_accepted: "Offer accepted — deal created",
  offer_declined: "Offer declined",
  offer_withdrawn: "Offer withdrawn",
  offer_cancelled: "Offer cancelled",
  offer_expired: "Offer expired",
  deal_meetup_proposed: "Meetup proposed",
  deal_meetup_confirmed: "Meetup confirmed",
  deal_completed: "Deal completed",
  deal_cancelled: "Deal cancelled",
  listing_sold: "Listing marked as sold",
  listing_deleted: "Listing deleted",
};

// The inbox line for a message, worked out the same way as on the server (utils/chat.js there).
export const previewOf = (message) => {
  let text = message.text;
  if (message.type === "image") text = message.text ? `📷 ${message.text}` : "📷 Photo";
  if (message.type === "offer") text = "💰 New offer";
  if (message.type === "system") text = SYSTEM_PREVIEWS[message.system?.event] ?? "Update";
  return { text: text.slice(0, 140), type: message.type, sender: message.sender, createdAt: message.createdAt };
};

// Moderation reasons stay vague on purpose, like the server's notifications (backend utils/offers.js).
const CANCEL_REASONS = {
  reserved: "the item was reserved for someone else",
  deleted: "the listing was deleted",
  unavailable: "the item is no longer available",
  flagged: "the item is no longer available",
  removed: "the item is no longer available",
  expired: "the listing expired",
};

// Why an offer was cancelled, from the reason code the server stores ("reserved", "sold", ...).
// "reserved": the listing's owner agreed a deal in another chat. The owner (`role`) hears that their
// way, and so does the visitor of a wanted post (they were selling, so nothing was reserved for them).
export const cancelReasonText = (reason, { type, role } = {}) => {
  if (reason === "sold") return `the listing was marked as ${soldLabel(type).toLowerCase()}`;
  if (reason === "reserved" && role === "owner") return `you accepted another ${type === "free" ? "request" : "offer"}`;
  if (reason === "reserved" && type === "wanted") return "they accepted another offer";
  return CANCEL_REASONS[reason] ?? "it's no longer available";
};

// "Library Gate, Tue, 5 Nov, 5:30 pm" for a meetup event (either part can be missing in old messages).
const meetupPlace = ({ spotName, at }) => [spotName, at && formatMeetupTime(at)].filter(Boolean).join(", ");

// The line shown in the middle of a chat. `who` is "You" when I caused it, else the other person's
// name. `role` ("owner" | "visitor") picks the wording where the two sides see an event differently.
export const systemText = (message, { myId, otherName, listing, role }) => {
  const { event, data = {}, actor } = message.system ?? {};
  const mine = Boolean(actor) && actor === myId;
  const who = actor ? (mine ? "You" : otherName) : null;
  const isRequest = listing?.type === "free";
  const noun = isRequest ? "request" : "offer";

  switch (event) {
    case "offer_countered": {
      if (isRequest) return who ? `${who} replied to the request` : "The request got a reply";
      const terms = describeTerms(data, listing);
      return who ? `${who} countered with ${terms}` : `Counter offer: ${terms}`;
    }
    case "offer_accepted": {
      // data.amount is the deal's total (rent: price × periods).
      let what = isRequest ? "the request" : listing?.type === "swap" ? "the swap" : formatRupees(data.amount ?? 0);
      if (listing?.type === "rent" && data.periods) what += ` for ${data.periods} ${periodWord(listing.rentPeriod, data.periods)}`;
      return who ? `${who} accepted ${what} — it's a deal 🎉` : `Accepted ${what} — it's a deal 🎉`;
    }
    case "offer_declined":
      return who ? `${who} declined the ${noun}` : `The ${noun} was declined`;
    case "offer_withdrawn":
      return who ? `${who} withdrew the ${noun}` : `The ${noun} was withdrawn`;
    case "offer_cancelled":
      // Closed because the owner agreed a deal in another chat.
      if (data.reason === "reserved") {
        if (role === "owner") return `You accepted another ${noun}, so this one was cancelled`;
        return listing?.type === "wanted"
          ? `${otherName} accepted another offer, so this one was cancelled`
          : `This item was reserved for someone else, so the ${noun} was cancelled`;
      }
      return `The ${noun} was cancelled: ${cancelReasonText(data.reason, { type: listing?.type, role })}`;
    case "offer_expired":
      return `The ${noun} expired without a reply`;
    case "deal_meetup_proposed": {
      const place = meetupPlace(data);
      const what = who ? `${who} proposed a meetup` : "A meetup was proposed";
      return place ? `${what}: ${place}` : what;
    }
    case "deal_meetup_confirmed": {
      const place = meetupPlace(data);
      const what = who ? `${who} confirmed the meetup` : "Meetup confirmed";
      return place ? `${what}: ${place}` : what;
    }
    case "deal_completed":
      // Only the buyer confirms a handover, with the seller's code.
      return who ? `${who} confirmed the handover — deal completed 🎉` : "Handed over — deal completed 🎉";
    case "deal_cancelled": {
      // "you changed your mind" / "they changed their mind"; "other" leaves it to the note.
      const reason = mine ? CANCEL_REASON_MAP[data.reason]?.mine : CANCEL_REASON_MAP[data.reason]?.theirs;
      const what = who ? `${who} cancelled the deal` : "The deal was cancelled";
      return reason ? `${what}: ${reason}` : what;
    }
    case "listing_sold":
      return `${who ?? "The owner"} marked the listing as ${soldLabel(listing?.type).toLowerCase()}`;
    case "listing_deleted":
      return `${who ?? "The owner"} deleted the listing`;
    default:
      return SYSTEM_PREVIEWS[event] ?? "Update";
  }
};
