import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { toast } from "sonner";
import ListingForm from "../../components/listings/ListingForm";
import { listingUploads } from "../../api/listings.api";
import { baseApi } from "../../api/baseApi";

export default function CreateListing() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleSubmit = async (formData, onProgress) => {
    const { listing, message } = await listingUploads.create(formData, onProgress);
    // The feed, "My listings" and profiles are now out of date: refetch them when next shown.
    dispatch(baseApi.util.invalidateTags(["Feed", "MyListings", "Profile"]));
    toast.success(message);
    navigate(`/listings/${listing._id}`, { replace: true });
  };

  return (
    <div className="animate-fade-up space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Post a listing</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">It's live for everyone on your campus as soon as you post.</p>
      </header>
      <ListingForm submitLabel="Post listing" onSubmit={handleSubmit} />
    </div>
  );
}
