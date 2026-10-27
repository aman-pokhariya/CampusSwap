import { TYPE_MAP } from "../../constants/listing";

// "For sale", "Free", ...: small white text, so it sits on the type's darker gradient (readable in
// both themes and over any photo).
export default function TypeBadge({ type, className = "" }) {
  const { badge, icon: Icon, textGradient } = TYPE_MAP[type];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-linear-to-r px-2.5 py-1 text-[11px] font-bold text-white shadow-sm ${textGradient} ${className}`}
    >
      <Icon className="size-3" strokeWidth={2.5} /> {badge}
    </span>
  );
}
