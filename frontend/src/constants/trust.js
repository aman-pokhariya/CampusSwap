import { BadgeCheck, Gift, Handshake, Leaf, Repeat, ShieldCheck, Star } from "lucide-react";

// Keep the values in sync with backend/config/constants.js (REPORT_REASONS).
export const REPORT_REASONS = [
  { value: "scam", label: "Scam or fraud", description: "Asks for money up front, fake payment proof, odd links" },
  { value: "prohibited", label: "Not allowed on CampusSwap", description: "Alcohol, vapes, drugs, weapons, exam leaks, anything illegal" },
  { value: "harassment", label: "Harassment", description: "Threats, insults or messages that make you uncomfortable" },
  { value: "fake", label: "Fake or misleading", description: "Wrong photos, false details, or pretending to be someone else" },
  { value: "spam", label: "Spam", description: "Ads, repeated posts, or nothing to do with the item" },
  { value: "other", label: "Something else", description: "Tell us what's wrong in the details below" },
];

export const MAX_REPORT_DETAILS = 1000;

// What each star means, for the review form ("4 stars, Great").
export const STAR_LABELS = ["", "Poor", "Okay", "Good", "Great", "Excellent"];

// Icon for each profile badge (backend utils/trust.js computeBadges).
export const BADGE_ICONS = {
  verified: BadgeCheck,
  first_deal: Handshake,
  trusted_seller: ShieldCheck,
  top_rated: Star,
  generous: Gift,
  swap_master: Repeat,
  eco_warrior: Leaf,
};
