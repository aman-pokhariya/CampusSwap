import { useId, useState } from "react";
import { Star } from "lucide-react";
import { STAR_LABELS } from "../../constants/trust";
import { formatRating, reviewCountLabel } from "../../utils/trust";

const SIZES = { sm: "size-3.5", md: "size-4", lg: "size-5" };
const STARS = [1, 2, 3, 4, 5];

// Read-only stars filled to the average (4.6 fills the fifth star 60%), with the number and how many
// reviews it's from. Screen readers hear one sentence instead of five pictures.
export default function StarRating({ value = 0, count, size = "md", showValue = true, className = "" }) {
  const starSize = SIZES[size];
  const label =
    count == null ? `Rated ${formatRating(value)} out of 5` : `Rated ${formatRating(value)} out of 5, from ${reviewCountLabel(count)}`;

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span role="img" aria-label={label} className="inline-flex gap-0.5">
        {STARS.map((star) => {
          const fill = Math.min(1, Math.max(0, value - (star - 1)));
          return (
            <span key={star} className={`relative ${starSize}`}>
              <Star className="absolute inset-0 size-full text-slate-300 dark:text-slate-600" aria-hidden />
              <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star className={`${starSize} fill-amber-400 text-amber-400`} aria-hidden />
              </span>
            </span>
          );
        })}
      </span>
      {showValue && (
        <span aria-hidden className="text-sm font-bold tabular-nums">
          {formatRating(value)}
        </span>
      )}
      {count != null && (
        <span aria-hidden className="text-sm text-slate-500 dark:text-slate-400">
          ({count})
        </span>
      )}
    </span>
  );
}

// Picking 1–5 stars. Real radio buttons underneath, so Tab reaches the group, the arrow keys change
// the rating and each star is read with its meaning ("4 stars, Great").
export function StarRatingInput({ value, onChange, legend = "Your rating", error, disabled = false }) {
  const name = useId();
  const [hovered, setHovered] = useState(0);
  const shown = hovered || value;

  return (
    <fieldset disabled={disabled}>
      <legend className="text-sm font-medium text-slate-700 dark:text-slate-300">{legend}</legend>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="flex" onMouseLeave={() => setHovered(0)}>
          {STARS.map((star) => (
            <label
              key={star}
              onMouseEnter={() => setHovered(star)}
              className="cursor-pointer rounded-lg p-1 transition active:scale-90 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-500"
            >
              <input
                type="radio"
                name={name}
                value={star}
                checked={value === star}
                onChange={() => onChange(star)}
                aria-invalid={Boolean(error) || undefined}
                className="sr-only"
              />
              <Star
                className={`size-8 transition ${star <= shown ? "fill-amber-400 text-amber-400" : "text-slate-300 dark:text-slate-600"}`}
                aria-hidden
              />
              <span className="sr-only">
                {star} {star === 1 ? "star" : "stars"}, {STAR_LABELS[star]}
              </span>
            </label>
          ))}
        </div>
        <span aria-hidden className={`text-sm font-semibold ${shown ? "text-amber-700 dark:text-amber-300" : "text-slate-500 dark:text-slate-400"}`}>
          {shown ? STAR_LABELS[shown] : "Tap a star"}
        </span>
      </div>
      {error && <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>}
    </fieldset>
  );
}
