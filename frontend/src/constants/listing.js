import {
  BookOpen,
  Bike,
  CalendarClock,
  Dumbbell,
  FlaskConical,
  Gift,
  Lamp,
  Laptop,
  Package,
  PenLine,
  Repeat,
  Search,
  Shapes,
  Shirt,
  Tag,
} from "lucide-react";

// Keep the `value`s in sync with backend/config/constants.js.
// `gradient` is for icon tiles; `textGradient` is darker, for anything with white text on it (type
// badges, the placeholder tile of a listing without photos): at least 4.5:1 contrast for small text.

export const LISTING_TYPES = [
  {
    value: "sell",
    label: "Sell",
    badge: "For sale",
    icon: Tag,
    gradient: "from-brand-500 to-violet-500",
    textGradient: "from-brand-600 to-violet-600",
    example: "Your cooler for ₹1,500 before you move out",
  },
  {
    value: "rent",
    label: "Rent",
    badge: "For rent",
    icon: CalendarClock,
    gradient: "from-sky-500 to-cyan-500",
    textGradient: "from-sky-700 to-cyan-700",
    example: "A lab coat for ₹20/day during practicals",
  },
  {
    value: "swap",
    label: "Swap",
    badge: "Swap",
    icon: Repeat,
    gradient: "from-violet-500 to-fuchsia-500",
    textGradient: "from-violet-600 to-fuchsia-700",
    example: "Your OS book for their DBMS book",
  },
  {
    value: "free",
    label: "Free",
    badge: "Free",
    icon: Gift,
    gradient: "from-emerald-500 to-teal-500",
    textGradient: "from-emerald-700 to-teal-700",
    example: "Graduating seniors giving it all away",
  },
  {
    value: "wanted",
    label: "Wanted",
    badge: "Wanted",
    icon: Search,
    gradient: "from-amber-500 to-orange-500",
    textGradient: "from-amber-700 to-orange-700",
    example: "“Looking for a cycle under ₹2,000”",
  },
  {
    value: "kit",
    label: "Semester kits",
    badge: "Kit",
    icon: Package,
    gradient: "from-rose-500 to-pink-500",
    textGradient: "from-rose-700 to-pink-700",
    example: "Every CSE Sem 3 book in one bundle",
  },
];

export const CATEGORIES = [
  { value: "books", label: "Books & notes", icon: BookOpen },
  { value: "electronics", label: "Electronics", icon: Laptop },
  { value: "cycles", label: "Cycles & vehicles", icon: Bike },
  { value: "hostel", label: "Hostel essentials", icon: Lamp },
  { value: "lab", label: "Lab & drafting", icon: FlaskConical },
  { value: "stationery", label: "Stationery", icon: PenLine },
  { value: "clothing", label: "Clothing", icon: Shirt },
  { value: "sports", label: "Sports & fitness", icon: Dumbbell },
  { value: "other", label: "Other", icon: Shapes },
];

export const CONDITIONS = [
  { value: "new", label: "Brand new", hint: "Unused, maybe still sealed" },
  { value: "like-new", label: "Like new", hint: "Used a few times, no marks" },
  { value: "good", label: "Good", hint: "Normal wear, works perfectly" },
  { value: "fair", label: "Fair", hint: "Visible wear, still usable" },
];

export const RENT_PERIODS = [
  { value: "day", label: "per day" },
  { value: "week", label: "per week" },
  { value: "month", label: "per month" },
];

export const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "nearest", label: "Nearest first" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "relevance", label: "Best match" },
];

export const DISTANCE_OPTIONS = [
  { value: "", label: "Anywhere on campus" },
  { value: "300", label: "Within 300 m" },
  { value: "700", label: "Within 700 m" },
  { value: "1500", label: "Within 1.5 km" },
];

export const MAX_PHOTOS = 5;

// Status changes an owner may make, by current status. "reserved" is missing on purpose:
// only finishing or cancelling the deal moves a listing out of it.
export const OWNER_TRANSITIONS = {
  active: ["sold"],
  sold: ["active"],
  expired: ["active"],
};

// Quick lookups: TYPE_MAP.sell.label, CATEGORY_MAP.books.icon, ...
const byValue = (items) => Object.fromEntries(items.map((item) => [item.value, item]));
export const TYPE_MAP = byValue(LISTING_TYPES);
export const CATEGORY_MAP = byValue(CATEGORIES);
export const CONDITION_MAP = byValue(CONDITIONS);
