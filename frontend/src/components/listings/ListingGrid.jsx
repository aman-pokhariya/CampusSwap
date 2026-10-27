import ListingCard, { ListingCardSkeleton } from "./ListingCard";

const gridClasses = "grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4";

export default function ListingGrid({ listings, loading = false, skeletons = 8, className = "" }) {
  return (
    <div className={`${gridClasses} ${className}`}>
      {listings.map((listing) => (
        <ListingCard key={listing._id} listing={listing} />
      ))}
      {loading && Array.from({ length: skeletons }, (_, i) => <ListingCardSkeleton key={`skeleton-${i}`} />)}
    </div>
  );
}
