import { useState } from "react";
import { toast } from "sonner";
import { Star } from "lucide-react";
import Button from "../ui/Button";
import { Textarea } from "../ui/Field";
import ReviewItem from "../trust/ReviewItem";
import { StarRatingInput } from "../trust/StarRating";
import { useReviewDealMutation } from "../../api/deals.api";
import { MAX_REVIEW_LENGTH } from "../../constants/deals";
import { firstName } from "../../utils/deals";

const card = "rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900";

function ReviewForm({ deal }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [errors, setErrors] = useState({});
  const [reviewDeal, { isLoading }] = useReviewDealMutation();
  const other = firstName(deal.otherUser?.name);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!rating) return setErrors({ rating: "Pick a star rating" });

    try {
      await reviewDeal({ dealId: deal._id, rating, comment: comment.trim() }).unwrap();
      toast.success("Thanks for the review!");
    } catch (err) {
      if (err.data?.errors) setErrors(err.data.errors);
      else toast.error(err.message); // e.g. already reviewed in another tab: the deal reloads with it
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
      <StarRatingInput
        value={rating}
        onChange={(value) => {
          setRating(value);
          setErrors((found) => ({ ...found, rating: undefined }));
        }}
        legend={`Rate ${other}`}
        error={errors.rating}
        disabled={isLoading}
      />
      <Textarea
        label="Add a comment (optional)"
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        maxLength={MAX_REVIEW_LENGTH}
        rows={3}
        placeholder="e.g. On time, friendly, and the book was exactly as described"
        error={errors.comment}
        disabled={isLoading}
      />
      <div className="flex justify-end">
        <Button type="submit" variant="gradient" loading={isLoading}>
          Post review
        </Button>
      </div>
    </form>
  );
}

// After the handover each side reviews the other once. The form, then both reviews: mine, and theirs
// (or a note that it hasn't come yet). `ref` lets the deal page jump here from "Leave a review".
export default function ReviewCard({ ref, deal }) {
  const { mine, theirs } = deal.reviews ?? {};
  const other = firstName(deal.otherUser?.name);

  return (
    <section ref={ref} id="review" className={`${card} scroll-mt-24`} aria-labelledby="review-title">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
          <Star className="size-5" aria-hidden />
        </span>
        <div>
          <h2 id="review-title" className="text-lg font-bold">
            {mine ? "Reviews" : `How was the deal with ${other}?`}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {mine ? "Reviews show on each other's profiles." : `Your review shows on ${other}'s profile and helps other students trust them.`}
          </p>
        </div>
      </div>

      {mine ? (
        <div className="mt-5 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
          <h3 className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">Your review</h3>
          <ReviewItem review={mine} showDeal={false} />
        </div>
      ) : (
        <ReviewForm deal={deal} />
      )}

      <div className="mt-4 rounded-2xl border border-dashed border-slate-200 p-4 dark:border-slate-700">
        <h3 className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">{other}'s review of you</h3>
        {theirs ? (
          <ReviewItem review={theirs} showDeal={false} />
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">{other} hasn't left a review yet.</p>
        )}
      </div>
    </section>
  );
}
