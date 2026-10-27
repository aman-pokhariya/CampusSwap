import { formatMeetupTime, formatRupees } from "./format";
import { periodWord } from "./chat";
import { CANCEL_REASON_MAP, MEETUP_MAX_DAYS } from "../constants/deals";

const DAY_MS = 24 * 60 * 60 * 1000;

// ── Status ────────────────────────────────────────────────

// Agreed or scheduled: the deal can still move on (meetup, handover) or be cancelled.
export const isOpenStatus = (status) => status === "agreed" || status === "scheduled";

export const firstName = (name = "") => name.split(" ")[0] || "They";

// Where a deal is on Agreed → Meetup set → Handed over: the number of steps done (1–3).
// A cancelled deal keeps the steps it reached.
export const dealStep = (deal) => {
  if (deal.status === "completed") return 3;
  return deal.status === "scheduled" || deal.meetup?.confirmed ? 2 : 1;
};

// The owner of a wanted post is its buyer; every other listing belongs to the seller.
export const isListingOwner = (deal) => (deal.listingType === "wanted" ? deal.role === "buyer" : deal.role === "seller");

// "You're buying" / "You're selling", in words that fit the listing type.
const ROLE_LABELS = {
  rent: { buyer: "You're renting", seller: "You're renting it out" },
  free: { buyer: "You're getting it", seller: "You're giving it away" },
  swap: { buyer: "You're getting it", seller: "You're swapping it" },
};

export const roleLabel = (deal) => {
  if (deal.role === "viewer") return "Admin view";
  return ROLE_LABELS[deal.listingType]?.[deal.role] ?? (deal.role === "buyer" ? "You're buying" : "You're selling");
};

// What the other person is doing in the deal, under their name: "Selling to you", "Renting from you".
const COUNTERPART_LABELS = {
  rent: { buyer: "Renting it to you", seller: "Renting it from you" },
  free: { buyer: "Giving it to you", seller: "Getting it from you" },
  swap: { buyer: "Swapping with you", seller: "Swapping with you" },
};

export const counterpartLabel = (deal) => {
  if (deal.role === "viewer") return "Seller"; // an admin's card shows the seller
  return COUNTERPART_LABELS[deal.listingType]?.[deal.role] ?? (deal.role === "buyer" ? "Selling to you" : "Buying from you");
};

// ── Formatting ────────────────────────────────────────────

const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

// "5 Nov 2026"
export const formatDealDate = (date) => dateFormatter.format(new Date(date));

// The deal's terms in a few words: "₹350", "₹60 for 3 days", "Free", "Swap + ₹100". A rent deal's
// amount is already the total; the period ("day") comes from the listing, when it's known (deal cards
// don't carry it: "₹60 · 3 rental periods").
export const formatDealAmount = ({ listingType, amount = 0, periods = 1 }, rentPeriod = null) => {
  switch (listingType) {
    case "free":
      return "Free";
    case "swap":
      return amount > 0 ? `Swap + ${formatRupees(amount)}` : "Swap";
    case "rent":
      return rentPeriod
        ? `${formatRupees(amount)} for ${periods} ${periodWord(rentPeriod, periods)}`
        : `${formatRupees(amount)} · ${periods} rental ${periods === 1 ? "period" : "periods"}`;
    default:
      return formatRupees(amount);
  }
};

// Why it was cancelled, from the reader's side ("you changed your mind" / "they changed their mind"),
// or null when the reason says nothing ("other").
export const cancelReasonPhrase = (reason, { mine }) => {
  const entry = CANCEL_REASON_MAP[reason];
  return (mine ? entry?.mine : entry?.theirs) ?? null;
};

// ── What's next ───────────────────────────────────────────

// The next step, as I see it: deal cards, the chat's deal banner and the deal page all say the same.
// `tone`: "action" (it's my move), "waiting" (theirs), "warning", "done" or "muted".
export const nextStepHint = (deal, myId, now = Date.now()) => {
  const other = firstName(deal.otherUser?.name);
  const { meetup } = deal;

  if (deal.status === "cancelled") return { text: "This deal was cancelled", tone: "muted" };
  if (deal.status === "completed") {
    return deal.needsReview ? { text: `Handed over · leave ${other} a review`, tone: "action" } : { text: "Handed over · all done", tone: "done" };
  }
  if (deal.role === "viewer") return { text: meetup ? `Meetup: ${meetup.spotName}` : "No meetup planned yet", tone: "muted" };
  if (deal.listing?.hidden) return { text: "Listing under review · you can still cancel", tone: "warning" };
  if (!meetup) return { text: "Pick a safe spot and a time to meet", tone: "action" };

  const when = `${meetup.spotName}, ${formatMeetupTime(meetup.at)}`;
  const passed = new Date(meetup.at).getTime() <= now;
  if (!meetup.confirmed) {
    if (meetup.proposedBy === myId) return { text: `Waiting for ${other} to confirm ${when}`, tone: "waiting" };
    return passed
      ? { text: `${other}'s meetup time has passed · suggest a new one`, tone: "action" }
      : { text: `${other} suggested ${when} · confirm it`, tone: "action" };
  }
  return deal.role === "seller"
    ? { text: `Meet at ${when} · show your handover code there`, tone: "action" }
    : { text: `Meet at ${when} · scan the seller's code there`, tone: "waiting" };
};

// What the other person just did, worked out from the deal before and after a deal:update, for a
// toast (and the deal page's screen-reader announcement). Null when it's nothing to tell, or when it
// could have been my own doing. A cancellation doesn't say who did it, so its words don't either.
export const dealNews = (previous, deal, myId) => {
  if (!previous || deal.role === "viewer") return null;
  const other = firstName(deal.otherUser?.name);
  const was = previous.status;

  if (deal.status === "completed" && was !== "completed") {
    // Only the buyer confirms the handover, so it's news to the seller.
    return deal.role === "seller" ? { title: "Handed over — deal completed 🎉", description: `${other} confirmed the handover of “${deal.title}”.` } : null;
  }
  if (deal.status === "cancelled" && was !== "cancelled") {
    return { title: "Deal cancelled", description: `The deal for “${deal.title}” was cancelled.` };
  }

  const now = deal.meetup;
  const before = previous.meetup;
  const sameMeetup = Boolean(before) && before.at === now?.at && before.spotId === now?.spotId && before.proposedBy === now?.proposedBy;
  if (now && !now.confirmed && now.proposedBy !== myId && (!sameMeetup || before.confirmed)) {
    return { title: `${other} suggested a meetup 📍`, description: `${now.spotName}, ${formatMeetupTime(now.at)}` };
  }
  if (now?.confirmed && !before?.confirmed && now.proposedBy === myId) {
    return { title: `${other} confirmed the meetup ✅`, description: `${now.spotName}, ${formatMeetupTime(now.at)}` };
  }
  return null;
};

// ── Meetup form ───────────────────────────────────────────

const pad = (value) => String(value).padStart(2, "0");

// The value a <input type="datetime-local"> uses: "2026-11-05T17:30", in local time.
export const toDateTimeLocal = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// One-tap times that are still at least half an hour away: "Today, 6 pm", "Tomorrow, 1 pm", …
export const quickMeetupTimes = (now = new Date()) => {
  const at = (days, hour) => {
    const date = new Date(now);
    date.setDate(date.getDate() + days);
    date.setHours(hour, 0, 0, 0);
    return date;
  };
  return [
    { label: "Today, 6 pm", date: at(0, 18) },
    { label: "Tomorrow, 1 pm", date: at(1, 13) },
    { label: "Tomorrow, 6 pm", date: at(1, 18) },
  ].filter(({ date }) => date.getTime() > now.getTime() + 30 * 60 * 1000);
};

export const meetupWindow = (now = Date.now()) => ({ min: toDateTimeLocal(now), max: toDateTimeLocal(now + MEETUP_MAX_DAYS * DAY_MS) });

// Same rules and words as the server (backend validators/deal.validators.js), so mistakes show at once.
export const validateMeetup = ({ spotId, at }, now = Date.now()) => {
  const errors = {};
  if (!spotId) errors.spotId = "Pick a safe spot";
  const time = at ? new Date(at).getTime() : NaN;
  if (Number.isNaN(time)) errors.at = "Pick a date and time";
  else if (time <= now) errors.at = "Pick a time in the future";
  else if (time > now + MEETUP_MAX_DAYS * DAY_MS) errors.at = `Pick a time in the next ${MEETUP_MAX_DAYS} days`;
  return errors;
};

// ── Handover ──────────────────────────────────────────────

const HANDOVER_QR = /^campusswap:handover:([a-f\d]{24}):([\w-]{32})$/i;

// The seller's QR code says "campusswap:handover:<dealId>:<token>". Only the token is sent, and only
// for this deal: a code from another deal would just use up a try.
export const parseHandoverQr = (text, dealId) => {
  const match = HANDOVER_QR.exec(String(text).trim());
  if (!match) return { error: "That isn't a CampusSwap handover code. Scan the QR on the seller's deal page." };
  if (match[1].toLowerCase() !== String(dealId).toLowerCase()) {
    return { error: "This QR code is for a different deal. Ask the seller to open this deal's handover code." };
  }
  return { token: match[2] };
};

// ── Toasts ────────────────────────────────────────────────

// One toast per deal: a notification about it and the live update that follows share it.
export const dealToastId = (dealId) => `deal:${dealId}`;

// "/deals/<id>" → "<id>"
export const dealIdOfLink = (link) => link?.match(/^\/deals\/([^/?#]+)/)?.[1] ?? null;
