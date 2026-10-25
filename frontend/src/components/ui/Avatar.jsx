const GRADIENTS = [
  "from-brand-500 to-violet-500",
  "from-sky-500 to-cyan-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-500",
  "from-violet-500 to-fuchsia-500",
];

const SIZES = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-lg",
  xl: "size-20 text-2xl",
};

const initialsOf = (name = "") =>
  name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";

// The same name always gets the same colour.
const hashOf = (text) => [...text].reduce((hash, ch) => (hash * 31 + ch.charCodeAt(0)) >>> 0, 7);

export default function Avatar({ name = "", src, size = "md", className = "" }) {
  if (src) {
    return <img src={src} alt={name} className={`${SIZES[size]} shrink-0 rounded-full object-cover ${className}`} />;
  }

  return (
    <span
      aria-hidden
      className={`grid ${SIZES[size]} shrink-0 place-items-center rounded-full bg-linear-to-br font-bold text-white ${
        GRADIENTS[hashOf(name) % GRADIENTS.length]
      } ${className}`}
    >
      {initialsOf(name)}
    </span>
  );
}
