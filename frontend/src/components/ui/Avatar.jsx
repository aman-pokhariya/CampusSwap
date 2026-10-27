import { imageUrl } from "../../utils/image";

const GRADIENTS = [
  "from-brand-500 to-violet-500",
  "from-sky-500 to-cyan-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-500",
  "from-violet-500 to-fuchsia-500",
];

// Tailwind classes, plus the pixel size to request from Cloudinary (2x for sharp screens).
const SIZES = {
  xs: { classes: "size-6 text-[10px]", px: 48 },
  sm: { classes: "size-8 text-xs", px: 64 },
  md: { classes: "size-10 text-sm", px: 80 },
  lg: { classes: "size-14 text-lg", px: 112 },
  xl: { classes: "size-20 text-2xl", px: 160 },
  "2xl": { classes: "size-28 text-4xl", px: 224 },
};

const initialsOf = (name = "") =>
  name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";

// The same name always gets the same colour.
const hashOf = (text) => [...text].reduce((hash, ch) => (hash * 31 + ch.charCodeAt(0)) >>> 0, 7);

export default function Avatar({ name = "", src, size = "md", className = "" }) {
  const { classes, px } = SIZES[size];

  if (src) {
    return (
      <img
        src={imageUrl(src, { width: px, height: px })}
        alt={name}
        className={`${classes} shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={`grid ${classes} shrink-0 place-items-center rounded-full bg-linear-to-br font-bold text-white ${
        GRADIENTS[hashOf(name) % GRADIENTS.length]
      } ${className}`}
    >
      {initialsOf(name)}
    </span>
  );
}
