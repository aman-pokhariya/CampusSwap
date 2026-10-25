import { CalendarClock, Gift, Package, Repeat, Search, Tag } from "lucide-react";

// The six kinds of listing. `value` will match the Listing model's `type` field in Chunk 2.
export const LISTING_TYPES = [
  {
    value: "sell",
    label: "Sell",
    icon: Tag,
    gradient: "from-brand-500 to-violet-500",
    example: "Your cooler for ₹1,500 before you move out",
  },
  {
    value: "rent",
    label: "Rent",
    icon: CalendarClock,
    gradient: "from-sky-500 to-cyan-500",
    example: "A lab coat for ₹20/day during practicals",
  },
  {
    value: "swap",
    label: "Swap",
    icon: Repeat,
    gradient: "from-violet-500 to-fuchsia-500",
    example: "Your OS book for their DBMS book",
  },
  {
    value: "free",
    label: "Free",
    icon: Gift,
    gradient: "from-emerald-500 to-teal-500",
    example: "Graduating seniors giving it all away",
  },
  {
    value: "wanted",
    label: "Wanted",
    icon: Search,
    gradient: "from-amber-500 to-orange-500",
    example: "“Looking for a cycle under ₹2,000”",
  },
  {
    value: "kit",
    label: "Semester kits",
    icon: Package,
    gradient: "from-rose-500 to-pink-500",
    example: "Every CSE Sem 3 book in one bundle",
  },
];
