import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { CircleCheck, RotateCcw, ShieldCheck, Trash } from "lucide-react";
import Avatar from "../ui/Avatar";
import Button from "../ui/Button";
import ConfirmDialog from "../ui/ConfirmDialog";
import EmptyState from "../ui/EmptyState";
import TypeBadge from "../listings/TypeBadge";
import { AccountChips, Chip, ListingThumb, ListSkeleton, LoadMore, PanelError, Segmented } from "./AdminShared";
import { useGetAdminListingsInfiniteQuery, useModerateListingMutation } from "../../api/admin.api";
import { LISTING_VIEWS } from "../../constants/admin";
import { contentBlocker, itemsOf } from "../../utils/admin";
import { firstName } from "../../utils/deals";
import { formatPrice, timeAgo } from "../../utils/format";

const EMPTY = {
  flagged: { title: "No listings waiting", description: "Listings hidden by several students' reports wait here until you approve or remove them." },
  removed: { title: "Nothing removed", description: "Listings removed by a moderator are kept here, in case one should come back." },
};

const SOURCE_LABELS = { reports: "Hidden by students' reports", ai: "Hidden by the automatic check", admin: "Changed by a moderator" };

const decisionCopy = (action, listing) => {
  const owner = firstName(listing.seller?.name);
  if (action === "remove") {
    return {
      title: `Remove “${listing.title}”?`,
      description: `It's hidden for good. An open deal on it is cancelled (neither side's trust score pays for it), its offers close and ${owner} is told why. Its open reports close as upheld.`,
      confirmLabel: "Remove listing",
      tone: "danger",
      icon: Trash,
    };
  }
  return {
    title: listing.moderation.state === "removed" ? `Make “${listing.title}” visible again?` : `Approve “${listing.title}”?`,
    description: `Everyone can see it again, with the status it had (a reserved listing stays reserved), and ${owner} is told. Its open reports close without counting against the students who sent them.`,
    confirmLabel: listing.moderation.state === "removed" ? "Restore listing" : "Approve",
    tone: "success",
    icon: CircleCheck,
  };
};

function ModerationRow({ listing, me, showCampus, onDecide }) {
  const { seller, moderation } = listing;
  const blocker = contentBlocker(seller, me);
  const removed = moderation.state === "removed";

  return (
    <li className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <Link to={`/listings/${listing._id}`} className="flex min-w-0 flex-1 gap-3 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">
          <ListingThumb listing={listing} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <TypeBadge type={listing.type} />
              {listing.openReports > 0 && (
                <Chip tone="rose">
                  {listing.openReports} open {listing.openReports === 1 ? "report" : "reports"}
                </Chip>
              )}
              {showCampus && listing.campus && <Chip>{listing.campus.shortName}</Chip>}
            </div>
            <p className="mt-1 truncate font-semibold">{listing.title}</p>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{formatPrice(listing)}</p>
            {listing.excerpt && <p className="mt-1 line-clamp-2 text-xs text-slate-600 [overflow-wrap:anywhere] dark:text-slate-300">{listing.excerpt}</p>}
          </div>
        </Link>

        {!blocker && (
          <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
            <Button size="sm" variant="secondary" onClick={() => onDecide(listing, "approve")} aria-label={`${removed ? "Restore" : "Approve"}: ${listing.title}`}>
              {removed ? <RotateCcw className="size-4" aria-hidden /> : <CircleCheck className="size-4" aria-hidden />}
              {removed ? "Restore" : "Approve"}
            </Button>
            {!removed && (
              <Button size="sm" variant="danger-ghost" onClick={() => onDecide(listing, "remove")} aria-label={`Remove: ${listing.title}`}>
                <Trash className="size-4" aria-hidden /> Remove
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <Avatar name={seller?.name ?? "?"} src={seller?.avatar?.url} size="xs" />
        <span className="font-semibold text-slate-700 dark:text-slate-200">{seller?.name ?? "A former member"}</span>
        <AccountChips user={seller} />
        <span aria-hidden>·</span>
        <span>
          {SOURCE_LABELS[moderation.source] ?? "Hidden"}
          {moderation.at && ` ${timeAgo(moderation.at)}`}
        </span>
        {moderation.reason && <span className="basis-full sm:basis-auto">Reason: {moderation.reason}</span>}
      </div>
      {blocker && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{blocker}.</p>}
    </li>
  );
}

// Listings hidden for review (approve or remove them), and the ones moderators removed (restore them).
export default function FlaggedListingsPanel({ campus, me }) {
  const [view, setView] = useState("flagged");
  const [pending, setPending] = useState(null); // { listing, action }
  const query = useGetAdminListingsInfiniteQuery({ campus, moderation: view });
  const { data, isLoading, isError, error, refetch, isFetching, isFetchingNextPage } = query;
  const listings = useMemo(() => itemsOf(data, "listings"), [data]);
  const [moderateListing, { isLoading: saving }] = useModerateListingMutation();
  const copy = pending ? decisionCopy(pending.action, pending.listing) : null;

  // The dialog closes before any toast: toasts are drawn underneath an open dialog.
  const confirm = async () => {
    try {
      const { message } = await moderateListing({ id: pending.listing._id, action: pending.action }).unwrap();
      setPending(null);
      toast.success(message);
    } catch (err) {
      setPending(null);
      toast.error(err.message);
    }
  };

  let content;
  if (isError && !data) content = <PanelError title="Couldn't load the listings" error={error} onRetry={refetch} />;
  else if (isLoading) content = <ListSkeleton />;
  else if (listings.length === 0) content = <EmptyState icon={ShieldCheck} {...EMPTY[view]} />;
  else {
    content = (
      <>
        <ul className="space-y-3">
          {listings.map((listing) => (
            <ModerationRow
              key={listing._id}
              listing={listing}
              me={me}
              showCampus={campus === "all"}
              onDecide={(target, action) => setPending({ listing: target, action })}
            />
          ))}
        </ul>
        <LoadMore query={query} label="Load more listings" />
      </>
    );
  }

  return (
    <div className="space-y-4" aria-busy={isFetching && !isFetchingNextPage}>
      <Segmented label="Which listings" options={LISTING_VIEWS} value={view} onChange={setView} />
      {content}
      <ConfirmDialog
        open={Boolean(pending)}
        title={copy?.title ?? ""}
        description={copy?.description}
        confirmLabel={copy?.confirmLabel}
        tone={copy?.tone}
        icon={copy?.icon}
        loading={saving}
        onConfirm={confirm}
        onClose={() => setPending(null)}
      />
    </div>
  );
}
