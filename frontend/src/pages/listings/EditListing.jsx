import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import { Lock, SearchX } from "lucide-react";
import ListingForm from "../../components/listings/ListingForm";
import EmptyState from "../../components/ui/EmptyState";
import Skeleton from "../../components/ui/Skeleton";
import { buttonClasses } from "../../components/ui/Button";
import { listingUploads, useGetListingQuery } from "../../api/listings.api";
import { baseApi } from "../../api/baseApi";
import { listingState } from "../../utils/listing";

// The server refuses to edit these (A1), so say why up front instead of letting the save fail.
const NOT_EDITABLE = {
  reserved: { title: "This listing is reserved", description: "Finish or cancel the deal before you edit it." },
  removed: { title: "A moderator removed this listing", description: "It can't be edited any more, but you can still delete it." },
  deleted: { title: "You deleted this listing", description: "Deleted listings can't be edited." },
};

export default function EditListing() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const me = useSelector((state) => state.auth.user);
  const { data, isLoading, isError } = useGetListingQuery(id);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-64 rounded-3xl" />
        <Skeleton className="h-48 rounded-3xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={SearchX}
        title="Listing not found"
        description="It may have been deleted."
        action={<Link to="/my-listings" className={buttonClasses({ variant: "secondary" })}>Back to my listings</Link>}
      />
    );
  }

  // Only the seller can edit (the server checks this too).
  if (data.listing.seller._id !== me._id) return <Navigate to={`/listings/${id}`} replace />;

  const blocked = NOT_EDITABLE[listingState(data.listing)];
  if (blocked) {
    return (
      <EmptyState
        icon={Lock}
        title={blocked.title}
        description={blocked.description}
        action={<Link to={`/listings/${id}`} className={buttonClasses({ variant: "secondary" })}>Back to the listing</Link>}
      />
    );
  }

  const handleSubmit = async (formData, onProgress) => {
    const { message } = await listingUploads.update(id, formData, onProgress);
    // A new title or price also shows in the chats about the listing.
    dispatch(baseApi.util.invalidateTags([{ type: "Listing", id }, "Feed", "MyListings", "Saved", "Profile", "Conversations"]));
    toast.success(message);
    navigate(`/listings/${id}`, { replace: true });
  };

  return (
    <div className="animate-fade-up space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Edit listing</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">Changes show up for everyone right away.</p>
      </header>
      {/* key: start fresh if you navigate from one edit page straight to another */}
      <ListingForm key={id} initial={data.listing} submitLabel="Save changes" onSubmit={handleSubmit} />
    </div>
  );
}
