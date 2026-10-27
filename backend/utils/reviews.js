import { idOf, isPopulated } from "./ids.js";
import { toPublicUser } from "./publicUser.js";
import { PUBLIC_USER_FIELDS } from "../config/constants.js";

// Everything toReviewShape() reads, for Review.find(...).populate(REVIEW_POPULATE).
export const REVIEW_POPULATE = [
    { path: "reviewer", select: PUBLIC_USER_FIELDS },
    { path: "deal", select: "title" }
];

// A review as the deal page and profiles show it: the reviewer's public fields, never more.
// `role` is the reviewer's side of the deal ("buyer": they bought from the person reviewed).
export const toReviewShape = (review) => ({
    _id: review._id,
    deal: idOf(review.deal),
    title: isPopulated(review.deal) ? review.deal.title ?? "" : "",
    rating: review.rating,
    comment: review.comment ?? "",
    role: review.role,
    reviewer: isPopulated(review.reviewer) ? toPublicUser(review.reviewer) : null,
    reviewee: idOf(review.reviewee),
    createdAt: review.createdAt
});
