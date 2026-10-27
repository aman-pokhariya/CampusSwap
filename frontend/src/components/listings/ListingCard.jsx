import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { Images, MapPin } from "lucide-react";
import TypeBadge from "./TypeBadge";
import SaveButton from "./SaveButton";
import Skeleton from "../ui/Skeleton";
import { TYPE_MAP } from "../../constants/listing";
import { formatLocation, formatPrice, timeAgo } from "../../utils/format";
import { imageUrl } from "../../utils/image";
import { listingState, stateLabel } from "../../utils/listing";

// Shown instead of a photo (e.g. "Wanted" posts don't need one). White text on the type's darker
// gradient, so its label stays readable.
export function TypeVisual({ type, className = "" }) {
  const { icon: Icon, textGradient, badge } = TYPE_MAP[type];
  return (
    <div className={`grid place-items-center bg-linear-to-br text-white ${textGradient} ${className}`}>
      <div className="flex flex-col items-center gap-2">
        <Icon className="size-10" strokeWidth={1.5} />
        <span className="text-sm font-bold tracking-wide uppercase">{badge}</span>
      </div>
    </div>
  );
}

// Under review, removed or deleted: only the owner ever gets these cards.
const HIDDEN_STATES = ["flagged", "removed", "deleted"];

// `preview` renders a non-clickable copy for the live preview on the sell form.
export default function ListingCard({ listing, preview = false }) {
  const me = useSelector((state) => state.auth.user);
  const cover = listing.images?.[0]?.url;
  const isMine = listing.seller?._id === me?._id || listing.seller === me?._id;
  // "Reserved", "Given away", "Under review"...; nothing while it's live.
  const statusLabel = stateLabel(listing);
  const hidden = HIDDEN_STATES.includes(listingState(listing));

  const body = (
    <>
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100 dark:bg-slate-800">
        {cover ? (
          <img
            src={imageUrl(cover, { width: 600, height: 450 })}
            alt={listing.title}
            loading="lazy"
            className="size-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <TypeVisual type={listing.type} className="size-full" />
        )}
        <TypeBadge type={listing.type} className="absolute top-2.5 left-2.5" />
        {listing.imageCount > 1 && (
          <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-slate-950/60 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
            <Images className="size-3" /> {listing.imageCount}
          </span>
        )}
        {statusLabel && (
          <div className="absolute inset-0 grid place-items-center bg-slate-950/50 backdrop-blur-[2px]">
            <span
              className={`rounded-full px-4 py-1.5 text-sm font-extrabold tracking-wide uppercase ${
                hidden ? "bg-amber-300 text-amber-950" : "bg-white text-slate-900"
              }`}
            >
              {statusLabel}
            </span>
          </div>
        )}
      </div>

      <div className="p-3.5">
        <p className="truncate text-lg leading-tight font-extrabold text-slate-900 dark:text-white">{formatPrice(listing)}</p>
        <h3 className="mt-1 line-clamp-1 text-sm font-semibold text-slate-700 dark:text-slate-200">{listing.title}</h3>
        <p className="mt-2 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">{formatLocation(listing, me?.hostel)}</span>
          <span aria-hidden>·</span>
          <span className="shrink-0">{timeAgo(listing.createdAt)}</span>
        </p>
      </div>
    </>
  );

  // The focus ring is drawn inside the link (negative offset), where the card's rounded clipping
  // can't cut it off.
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white transition duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900 dark:hover:shadow-black/30">
      {preview ? (
        <div>{body}</div>
      ) : (
        <Link
          to={`/listings/${listing._id}`}
          className="block rounded-2xl focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500"
        >
          {body}
        </Link>
      )}
      {!preview && !isMine && !hidden && <SaveButton listing={listing} className="absolute top-2 right-2" />}
    </article>
  );
}

export function ListingCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <Skeleton className="aspect-[4/3] rounded-none" />
      <div className="space-y-2 p-3.5">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-3/5" />
      </div>
    </div>
  );
}
