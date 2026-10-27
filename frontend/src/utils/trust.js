// No trust record yet (accounts from before trust existed), or no finished deals and no reviews:
// too early for a score to mean anything, so it reads "New member" instead (architecture A9).
export const isNewMember = (trust) => !trust || (trust.completedDeals ?? 0) + (trust.ratingCount ?? 0) === 0;

// The score as shown: a whole number from 0 to 100 (50 is where everyone starts).
export const trustScore = (trust) => Math.round(Math.min(100, Math.max(0, trust?.score ?? 50)));

// The ring's colour and the word under it.
export const trustLevel = (score) => {
  if (score >= 80) return { label: "Excellent", tone: "high" };
  if (score >= 60) return { label: "Good", tone: "high" };
  if (score >= 40) return { label: "Fair", tone: "mid" };
  return { label: "Low", tone: "low" };
};

// "4.6"
export const formatRating = (average) => (Math.round(average * 10) / 10).toFixed(1);

export const reviewCountLabel = (count) => `${count} ${count === 1 ? "review" : "reviews"}`;
