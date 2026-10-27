import { Link } from "react-router-dom";
import { Compass, Heart } from "lucide-react";
import ListingGrid from "../../components/listings/ListingGrid";
import EmptyState from "../../components/ui/EmptyState";
import Alert from "../../components/ui/Alert";
import { buttonClasses } from "../../components/ui/Button";
import { useGetSavedListingsQuery } from "../../api/listings.api";

export default function SavedListings() {
  const { data, isLoading, isError, error } = useGetSavedListingsQuery();
  const listings = data?.listings ?? [];

  return (
    <div className="animate-fade-up space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Saved</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">Things you're keeping an eye on.</p>
      </header>

      {isError ? (
        <Alert type="error">{error?.message}</Alert>
      ) : isLoading ? (
        <ListingGrid listings={[]} loading skeletons={4} />
      ) : listings.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="Nothing saved yet"
          description="Tap the ♥ on any listing to keep it here, so you can come back to it later."
          action={
            <Link to="/home" className={buttonClasses({ variant: "secondary" })}>
              <Compass className="size-4" /> Explore listings
            </Link>
          }
        />
      ) : (
        <ListingGrid listings={listings} />
      )}
    </div>
  );
}
