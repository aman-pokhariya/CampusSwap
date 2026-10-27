// Keep the values in sync with backend/config/constants.js.

export const MEETUP_MAX_DAYS = 30;
export const MAX_CANCEL_NOTE_LENGTH = 300;
export const MAX_REVIEW_LENGTH = 500;
export const HANDOVER_TTL_MINUTES = 10;

// Why a deal was cancelled. `label` is what the person cancelling picks; `mine` and `theirs` are how
// the chat and the deal page say it afterwards ("Riya cancelled the deal: they changed their mind").
// "other" adds nothing, the note says it.
export const CANCEL_REASONS = [
  { value: "changed_mind", label: "I changed my mind", mine: "you changed your mind", theirs: "they changed their mind" },
  { value: "found_another", label: "I found another option", mine: "you found another option", theirs: "they found another option" },
  { value: "no_show", label: "They didn't show up", mine: "the meetup didn't happen", theirs: "the meetup didn't happen" },
  {
    value: "not_as_described",
    label: "The item wasn't as described",
    mine: "the item wasn't as described",
    theirs: "the item wasn't as described",
  },
  { value: "other", label: "Something else", mine: null, theirs: null },
];

export const CANCEL_REASON_MAP = Object.fromEntries(CANCEL_REASONS.map((reason) => [reason.value, reason]));

// The tabs on /deals, with the ?status= each one asks the server for.
export const DEAL_TABS = [
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export const DEAL_STEPS = ["Agreed", "Meetup set", "Handed over"];
