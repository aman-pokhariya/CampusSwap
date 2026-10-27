import { Link } from "react-router-dom";
import Avatar from "../ui/Avatar";
import StarRating from "./StarRating";
import { timeAgo } from "../../utils/format";

// One review: who wrote it, their stars and words, and which deal it was about. `role` is the
// reviewer's side of that deal ("buyer": they got the item from the person reviewed).
export default function ReviewItem({ review, showDeal = true }) {
  const { reviewer } = review;
  const name = reviewer?.name ?? "CampusSwap member";

  return (
    <article className="flex gap-3">
      {reviewer ? (
        <Link to={`/u/${reviewer._id}`} aria-label={`${name}'s profile`} className="shrink-0 self-start rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">
          <Avatar name={name} src={reviewer.avatar?.url} />
        </Link>
      ) : (
        <Avatar name={name} />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className="truncate font-semibold">{name}</p>
          <time dateTime={review.createdAt} className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
            {timeAgo(review.createdAt)}
          </time>
        </div>
        <StarRating value={review.rating} size="sm" showValue={false} className="mt-0.5" />
        {review.comment && (
          <p className="mt-1.5 text-sm whitespace-pre-line text-slate-700 [overflow-wrap:anywhere] dark:text-slate-300">{review.comment}</p>
        )}
        {showDeal && review.title && (
          <p className="mt-1.5 truncate text-xs text-slate-500 dark:text-slate-400">
            {review.role === "buyer" ? "Buyer" : "Seller"} · “{review.title}”
          </p>
        )}
      </div>
    </article>
  );
}
