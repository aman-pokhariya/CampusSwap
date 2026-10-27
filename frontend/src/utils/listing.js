import { OWNER_TRANSITIONS } from "../constants/listing";
import { soldLabel } from "./format";

// Where a listing stands, in one word. Moderation and deletion win over the lifecycle status,
// because they decide whether anyone else can see it at all (backend utils/listingVisibility.js).
export const listingState = (listing) => {
  if (listing.deletedAt) return "deleted";
  if (listing.moderation?.state === "removed") return "removed";
  if (listing.moderation?.state === "flagged") return "flagged";
  return listing.status;
};

const STATE_LABELS = {
  deleted: "Deleted",
  removed: "Removed",
  flagged: "Under review",
  reserved: "Reserved",
  expired: "Expired",
};

// The badge on a card or row ("Reserved", "Given away", ...), or null while it's live.
export const stateLabel = (listing) => {
  const state = listingState(listing);
  return state === "sold" ? soldLabel(listing.type, listing.rentedUntil) : (STATE_LABELS[state] ?? null);
};

// "Put back on sale" says the wrong thing for some types.
const reopenLabel = (type) => {
  if (type === "rent") return { label: "Mark as returned", shortLabel: "Returned", done: "Marked as returned — it's available again" };
  if (type === "wanted") return { label: "I'm still looking", shortLabel: "Reopen", done: "Your post is live again" };
  if (type === "free" || type === "swap") return { label: "Make available again", shortLabel: "Reopen", done: "It's available again" };
  return { label: "Put back on sale", shortLabel: "On sale", done: "Back on sale" };
};

// The status changes the owner may make right now; the server enforces the same rules. Listings
// under review or removed can't change status, and reserved ones wait for their deal.
export const ownerStatusActions = (listing) => {
  const state = listingState(listing);
  if (state === "deleted" || state === "removed" || state === "flagged") return [];

  return (OWNER_TRANSITIONS[listing.status] ?? []).map((status) => {
    if (status === "sold") {
      const sold = soldLabel(listing.type);
      return { status, label: `Mark as ${sold.toLowerCase()}`, shortLabel: sold, done: `Marked as ${sold.toLowerCase()} 🎉` };
    }
    if (listing.status === "expired") {
      return { status, label: "Relist", shortLabel: "Relist", done: "Relisted — it's live for another 60 days" };
    }
    return { status, ...reopenLabel(listing.type) };
  });
};
