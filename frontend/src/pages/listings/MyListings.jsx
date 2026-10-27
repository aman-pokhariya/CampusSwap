import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { CircleCheck, Eye, Heart, MessagesSquare, Pencil, Plus, RotateCcw, Store, Tag, Trash } from "lucide-react";
import TypeBadge from "../../components/listings/TypeBadge";
import { TypeVisual } from "../../components/listings/ListingCard";
import Button, { buttonClasses } from "../../components/ui/Button";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import EmptyState from "../../components/ui/EmptyState";
import Skeleton from "../../components/ui/Skeleton";
import Alert from "../../components/ui/Alert";
import { useDeleteListingMutation, useGetMyListingsQuery, useUpdateListingStatusMutation } from "../../api/listings.api";
import { formatPrice, soldLabel, timeAgo } from "../../utils/format";
import { imageUrl } from "../../utils/image";
import { listingState, ownerStatusActions, stateLabel } from "../../utils/listing";

// Tabs follow the lifecycle status; "Under review" / "Removed" show as badges on any tab.
const TABS = [
  { value: "active", label: "Active", match: (l) => l.status === "active" || l.status === "reserved" },
  { value: "sold", label: "Sold", match: (l) => l.status === "sold" },
  { value: "expired", label: "Expired", match: (l) => l.status === "expired" },
  { value: "all", label: "All", match: () => true },
];

// A line under the row explaining why some buttons are missing.
const STATE_NOTES = {
  reserved: "Reserved for a deal. Finish or cancel it to make changes.",
  flagged: "Under review: hidden from others until a moderator checks it.",
  removed: "Removed by a moderator. Only you can see it.",
};

const BADGE_TONES = {
  reserved: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  flagged: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  removed: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  sold: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  expired: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

function StatTile({ icon: Icon, label, value, tone }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <span className={`grid size-9 place-items-center rounded-xl ${tone}`}>
        <Icon className="size-[18px]" />
      </span>
      <p className="mt-3 text-2xl font-extrabold tabular-nums">{value}</p>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

function ListingRow({ listing, onChangeStatus, onDelete, busy }) {
  const cover = listing.images?.[0]?.url;
  const state = listingState(listing);
  const badge = stateLabel(listing);
  // Only the moves the server allows from this state (A1); reserved and removed listings can't be edited.
  const statusActions = ownerStatusActions(listing);
  const canEdit = state !== "reserved" && state !== "removed";
  const canDelete = state !== "reserved";

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Link to={`/listings/${listing._id}`} className="flex min-w-0 flex-1 items-center gap-3">
          <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
            {cover ? (
              <img src={imageUrl(cover, { width: 160, height: 160 })} alt="" className="size-full object-cover" />
            ) : (
              <TypeVisual type={listing.type} className="size-full [&_span]:hidden [&_svg]:size-7" />
            )}
            {listing.status === "sold" && (
              <span className="absolute inset-0 grid place-items-center bg-slate-950/55 px-1 text-center text-[11px] font-extrabold text-white uppercase">
                {soldLabel(listing.type)}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <TypeBadge type={listing.type} />
              {badge && <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${BADGE_TONES[state] ?? BADGE_TONES.expired}`}>{badge}</span>}
            </div>
            <p className="mt-1 truncate font-semibold">{listing.title}</p>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{formatPrice(listing)}</p>
            <p className="mt-0.5 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1"><Eye className="size-3.5" /> {listing.views}</span>
              <span className="inline-flex items-center gap-1"><Heart className="size-3.5" /> {listing.saves}</span>
              <span>{timeAgo(listing.createdAt)}</span>
            </p>
          </div>
        </Link>

        <div className="grid grid-cols-3 gap-2 sm:flex sm:shrink-0">
          {state === "reserved" && (
            <Link to={`/inbox?listing=${listing._id}`} className={buttonClasses({ variant: "secondary", size: "sm", className: "col-span-3" })}>
              <MessagesSquare className="size-4" /> View chats
            </Link>
          )}
          {canEdit && (
            <Link to={`/listings/${listing._id}/edit`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
              <Pencil className="size-4" /> Edit
            </Link>
          )}
          {statusActions.map((action) => (
            <Button
              key={action.status}
              variant="secondary"
              size="sm"
              onClick={() => onChangeStatus(listing, action)}
              disabled={busy}
              aria-label={`${action.label}: ${listing.title}`}
            >
              {action.status === "sold" ? <CircleCheck className="size-4" /> : <RotateCcw className="size-4" />}
              {action.shortLabel}
            </Button>
          ))}
          {canDelete && (
            <Button variant="danger-ghost" size="sm" onClick={() => onDelete(listing)} aria-label={`Delete ${listing.title}`}>
              <Trash className="size-4" /> <span className="sm:hidden">Delete</span>
            </Button>
          )}
        </div>
      </div>

      {STATE_NOTES[state] && <p className="mt-2 px-1 text-xs text-slate-500 dark:text-slate-400">{STATE_NOTES[state]}</p>}
    </li>
  );
}

export default function MyListings() {
  const { data, isLoading, isError, error } = useGetMyListingsQuery();
  const [updateStatus, { isLoading: updating }] = useUpdateListingStatusMutation();
  const [deleteListing, { isLoading: deleting }] = useDeleteListingMutation();
  const [tab, setTab] = useState("active");
  const [toDelete, setToDelete] = useState(null);

  const listings = data?.listings ?? [];
  const current = TABS.find((t) => t.value === tab);
  const shown = listings.filter(current.match);
  const counts = Object.fromEntries(TABS.map((t) => [t.value, listings.filter(t.match).length]));

  const changeStatus = async (listing, action) => {
    try {
      await updateStatus({ id: listing._id, status: action.status }).unwrap();
      toast.success(action.done);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const confirmDelete = async () => {
    try {
      await deleteListing(toDelete._id).unwrap();
      toast.success("Listing deleted");
      setToDelete(null);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="animate-fade-up space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">My listings</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">Everything you've posted, in one place.</p>
        </div>
        <Link to="/sell" className={buttonClasses({ variant: "gradient" })}>
          <Plus className="size-4" /> New listing
        </Link>
      </header>

      {isError && <Alert type="error">{error?.message}</Alert>}

      {isLoading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[1, 2, 3, 4].map((n) => <Skeleton key={n} className="h-28 rounded-2xl" />)}
          </div>
          {[1, 2, 3].map((n) => <Skeleton key={n} className="h-24 rounded-2xl" />)}
        </div>
      ) : (
        data && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile icon={Tag} label="Active listings" value={data.stats.active} tone="bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400" />
              <StatTile icon={CircleCheck} label="Sold" value={data.stats.sold} tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" />
              <StatTile icon={Eye} label="Total views" value={data.stats.views} tone="bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400" />
              <StatTile icon={Heart} label="Times saved" value={data.stats.saves} tone="bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400" />
            </div>

            {listings.length === 0 ? (
              <EmptyState
                icon={Store}
                title="You haven't posted anything yet"
                description="Old books, a cycle, that cooler you won't need next semester: someone on campus wants it."
                action={
                  <Link to="/sell" className={buttonClasses({ variant: "gradient" })}>
                    <Plus className="size-4" /> Post your first listing
                  </Link>
                }
              />
            ) : (
              <>
                <div className="flex gap-1 rounded-xl bg-slate-100 p-1 sm:w-fit dark:bg-slate-800/70" role="tablist">
                  {TABS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      role="tab"
                      aria-selected={tab === value}
                      onClick={() => setTab(value)}
                      className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition sm:flex-none sm:px-4 ${
                        tab === value
                          ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                          : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                      }`}
                    >
                      {label} <span className="text-slate-400">{counts[value]}</span>
                    </button>
                  ))}
                </div>

                {shown.length === 0 ? (
                  <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">Nothing here.</p>
                ) : (
                  <ul className="space-y-3">
                    {shown.map((listing) => (
                      <ListingRow key={listing._id} listing={listing} onChangeStatus={changeStatus} onDelete={setToDelete} busy={updating} />
                    ))}
                  </ul>
                )}
              </>
            )}
          </>
        )
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete this listing?"
        description={toDelete ? `“${toDelete.title}” will be removed for everyone, and chats about it are closed. This can't be undone.` : ""}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
