import { Heart } from "lucide-react";
import { toast } from "sonner";
import { useSetSavedMutation } from "../../api/listings.api";

// The heart. `listing.isSaved` flips instantly because the mutation patches every cached copy
// of this listing (see setSaved in listings.api.js), and flips back if the request fails.
export default function SaveButton({ listing, variant = "floating", className = "" }) {
  const [setSaved] = useSetSavedMutation();
  const saved = Boolean(listing.isSaved);

  const toggle = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      await setSaved({ id: listing._id, saved: !saved }).unwrap();
      if (!saved) toast.success("Saved — find it under Saved anytime");
    } catch (error) {
      toast.error(error.message || "Couldn't update your saved items");
    }
  };

  const styles =
    variant === "floating"
      ? "size-9 rounded-full bg-white/90 shadow-sm backdrop-blur hover:scale-110 dark:bg-slate-900/90"
      : "h-11 gap-2 rounded-xl px-4 text-sm font-semibold ring-1 ring-slate-200 hover:bg-slate-50 dark:ring-slate-700 dark:hover:bg-slate-800";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save"}
      className={`inline-flex items-center justify-center transition active:scale-90 ${styles} ${className}`}
    >
      <Heart
        className={`size-[18px] transition ${saved ? "scale-110 fill-rose-500 text-rose-500" : "text-slate-600 dark:text-slate-300"}`}
      />
      {variant !== "floating" && (saved ? "Saved" : "Save")}
    </button>
  );
}
