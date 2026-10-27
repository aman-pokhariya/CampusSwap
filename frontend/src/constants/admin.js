// Keep the values in sync with backend/config/constants.js and controllers/admin.controllers.js.

// The tabs on /admin. `count` names the overview number shown next to the tab.
export const ADMIN_TABS = [
  { value: "overview", label: "Overview", shortLabel: "Overview" },
  { value: "reports", label: "Reports", shortLabel: "Reports", count: "reports" },
  { value: "listings", label: "Flagged listings", shortLabel: "Flagged", count: "flagged" },
  { value: "users", label: "Users", shortLabel: "Users" },
];

export const REPORT_STATUS_FILTERS = [
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
];

export const LISTING_VIEWS = [
  { value: "flagged", label: "Under review" },
  { value: "removed", label: "Removed" },
];

export const BANNED_FILTERS = [
  { value: "", label: "Everyone" },
  { value: "false", label: "Active accounts" },
  { value: "true", label: "Suspended" },
];

// What a report is about, as its card says it.
export const REPORT_TARGET_LABELS = { listing: "Listing", user: "Student", message: "Chat message" };

// The decision recorded on a closed report (backend REPORT_ACTIONS).
export const REPORT_OUTCOMES = {
  none: "Dismissed",
  listing_removed: "Listing removed",
  listing_restored: "Listing restored",
  user_warned: "Student warned",
  user_banned: "Account suspended",
};

export const MAX_ADMIN_NOTE_LENGTH = 500;
