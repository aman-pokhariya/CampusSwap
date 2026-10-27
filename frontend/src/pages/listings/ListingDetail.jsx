import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { toast } from "sonner";
import {
  ArrowLeft,
  BadgeCheck,
  CircleCheck,
  Clock,
  Eye,
  Flag,
  Gift,
  HandCoins,
  Heart,
  MapPin,
  MessageCircle,
  MessagesSquare,
  Pencil,
  Repeat,
  RotateCcw,
  Search,
  SearchX,
  Share2,
  ShieldCheck,
  Trash,
} from "lucide-react";
import ImageGallery from "../../components/listings/ImageGallery";
import ListingGrid from "../../components/listings/ListingGrid";
import SaveButton from "../../components/listings/SaveButton";
import TypeBadge from "../../components/listings/TypeBadge";
import ReportDialog from "../../components/trust/ReportDialog";
import StarRating from "../../components/trust/StarRating";
import TrustRing from "../../components/trust/TrustRing";
import Alert from "../../components/ui/Alert";
import Avatar from "../../components/ui/Avatar";
import Button, { buttonClasses } from "../../components/ui/Button";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import EmptyState from "../../components/ui/EmptyState";
import Menu from "../../components/ui/Menu";
import Skeleton from "../../components/ui/Skeleton";
import { useDeleteListingMutation, useGetListingQuery, useUpdateListingStatusMutation } from "../../api/listings.api";
import { useGetConversationsInfiniteQuery, useStartConversationMutation } from "../../api/chat.api";
import { useGoBack } from "../../hooks/useGoBack";
import { CATEGORY_MAP, CONDITION_MAP } from "../../constants/listing";
import { formatLocation, formatMonthYear, formatRupees, soldLabel, timeAgo } from "../../utils/format";
import { listingState, ownerStatusActions, stateLabel } from "../../utils/listing";

const card = "rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900";

// The second button next to "Message seller": what an offer is called for each type.
const OFFER_BUTTONS = {
  free: { label: "Request it", icon: Gift },
  swap: { label: "Offer a swap", icon: Repeat },
  wanted: { label: "I have this", icon: Search },
};

function PriceBlock({ listing }) {
  const chip = (text, tone = "slate") => (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
        tone === "emerald"
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      }`}
    >
      {text}
    </span>
  );
  const negotiable = listing.negotiable ? chip("Negotiable", "emerald") : chip("Fixed price");

  switch (listing.type) {
    case "free":
      return (
        <div className="mt-4">
          <p className="text-4xl font-extrabold text-emerald-600 dark:text-emerald-400">Free</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Just pick it up. Someone on campus is giving it away.</p>
        </div>
      );
    case "swap":
      return (
        <div className="mt-4 rounded-2xl bg-violet-50 p-4 dark:bg-violet-500/10">
          <p className="text-xs font-semibold tracking-wide text-violet-600 uppercase dark:text-violet-300">Wants in exchange</p>
          <p className="mt-1 text-lg font-bold text-violet-950 dark:text-violet-100">{listing.swapFor}</p>
          {listing.price ? (
            <p className="mt-1 text-sm text-violet-800/80 dark:text-violet-200/80">or buy it for {formatRupees(listing.price)}</p>
          ) : null}
        </div>
      );
    case "wanted":
      return (
        <div className="mt-4">
          <p className="text-3xl font-extrabold">{listing.price ? `Up to ${formatRupees(listing.price)}` : "Open to offers"}</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">This student is looking for this item. Have one?</p>
        </div>
      );
    case "rent":
      return (
        <div className="mt-4 flex flex-wrap items-end gap-x-3 gap-y-2">
          <p className="text-4xl font-extrabold">
            {formatRupees(listing.price)}
            <span className="text-lg font-semibold text-slate-500 dark:text-slate-400"> / {listing.rentPeriod}</span>
          </p>
          {negotiable}
        </div>
      );
    default:
      return (
        <div className="mt-4 flex flex-wrap items-end gap-x-3 gap-y-2">
          <p className="text-4xl font-extrabold">{formatRupees(listing.price)}</p>
          {listing.type === "kit" && chip(`${listing.kitItems.length} items`)}
          {negotiable}
        </div>
      );
  }
}

// Why the listing isn't simply for sale, told to its owner or to a visitor. Visitors never see the
// hidden states: those listings are a 404 for them. `myChat` is the visitor's own chat about it.
function StatusBanner({ listing, isOwner, myChat, loadingMyChat }) {
  const state = listingState(listing);
  const sold = soldLabel(listing.type, listing.rentedUntil);
  const reason = listing.moderation?.reason;

  switch (state) {
    case "deleted":
      return <Alert type="error" title="You deleted this listing">It's hidden from everyone, and chats about it are closed.</Alert>;
    case "removed":
      return (
        <Alert type="error" title="Removed by a moderator">
          <p>It's hidden from everyone, and chats about it are closed. You can still delete it.</p>
          {reason && <p className="mt-1">Reason: {reason}</p>}
        </Alert>
      );
    case "flagged":
      return (
        <Alert type="warning" title="We're reviewing this listing — it's hidden for now">
          Other students can't see it until a moderator has checked it. Your chats stay open; offers and handovers wait
          until then.
        </Alert>
      );
    case "reserved":
      if (isOwner) {
        return (
          <Alert type="warning" title="Reserved for a deal">
            Finish or cancel the deal before you edit, relist or delete it.
          </Alert>
        );
      }
      // Only the visitor's chat can tell whose deal this is: wait for it rather than guess wrong.
      if (loadingMyChat) return null;
      // The reservation belongs to the deal in my own chat (A2): it's being held for me.
      if (listing.reservedFor && myChat?.deal?._id === listing.reservedFor) {
        return (
          <Alert type="success" title={listing.type === "wanted" ? "You have a deal" : "Reserved for you"}>
            Nobody else can make an offer while your deal is on. Agree on a meetup in your chat.
          </Alert>
        );
      }
      return (
        <Alert type="warning" title="Reserved">
          Another student has a deal on this item. It comes back if the deal falls through.
        </Alert>
      );
    case "sold":
      if (isOwner) {
        return (
          <Alert type="success" title={`${sold} 🎉`}>
            {listing.type === "rent" ? "Mark it as returned once you have it back." : "Put it back on sale if the deal fell through."}
          </Alert>
        );
      }
      return (
        <Alert type="info" title={sold}>
          {listing.type === "rent" && listing.rentedUntil ? "It may be free to rent again after that." : "This item isn't available any more."}
        </Alert>
      );
    case "expired":
      return isOwner ? (
        <Alert type="info" title="Expired">
          It's hidden from the feed. Relist it to show it for another 60 days.
        </Alert>
      ) : (
        <Alert type="info" title="Expired">
          {listing.type === "wanted"
            ? "The buyer hasn't relisted it, so they may not need it any more."
            : "The seller hasn't relisted it, so it may not be available."}
        </Alert>
      );
    default:
      return null;
  }
}

function DetailSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <Skeleton className="aspect-[4/3] rounded-3xl" />
      <div className="space-y-4">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-9 w-4/5" />
        <Skeleton className="h-12 w-40" />
        <Skeleton className="h-28 rounded-3xl" />
      </div>
    </div>
  );
}

export default function ListingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  // Came from inside the app → go back there; opened from a shared link → go to Explore.
  const goBack = useGoBack("/home");
  const me = useSelector((state) => state.auth.user);
  const { data, isLoading, isError, error, refetch } = useGetListingQuery(id);
  const [updateStatus, { isLoading: updatingStatus }] = useUpdateListingStatusMutation();
  const [deleteListing, { isLoading: deleting }] = useDeleteListingMutation();
  const [startConversation] = useStartConversationMutation();
  const [opening, setOpening] = useState(null); // "message" | "offer" while the chat is being opened
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  // A visitor can't start a new chat once the item is gone, but can still open the one they have.
  // Its deal also tells the status banner whether a reservation is theirs.
  const loadedListing = data?.listing;
  const findMyChat = Boolean(loadedListing) && loadedListing.seller._id !== me._id && listingState(loadedListing) !== "active";
  const { data: myChats, isLoading: loadingMyChat } = useGetConversationsInfiniteQuery({ listing: id }, { skip: !findMyChat });
  const existingChat = myChats?.pages[0]?.conversations[0];

  if (isLoading) return <DetailSkeleton />;

  if (isError) {
    return (
      <EmptyState
        icon={SearchX}
        title={error.status === 404 ? "Listing not found" : "Couldn't load this listing"}
        description={error.status === 404 ? "It may have been deleted, or it belongs to another campus." : error.message}
        action={<Link to="/home" className={buttonClasses({ variant: "secondary" })}>Back to Explore</Link>}
      />
    );
  }

  const { listing, sellerStats, similar } = data;
  const isOwner = listing.seller._id === me._id;
  const state = listingState(listing);
  const badge = stateLabel(listing);
  const category = CATEGORY_MAP[listing.category];
  const condition = CONDITION_MAP[listing.condition];
  const offerButton = OFFER_BUTTONS[listing.type] ?? { label: "Make offer", icon: HandCoins };
  const OfferIcon = offerButton.icon;

  // What the owner may do now (A1): the server refuses the rest anyway.
  const statusActions = isOwner ? ownerStatusActions(listing) : [];
  const canEdit = !["reserved", "removed", "deleted"].includes(state);
  const canDelete = !["reserved", "deleted"].includes(state);
  const halfButtons = (canEdit ? 1 : 0) + statusActions.length;
  // A wanted post is written by the buyer; the owner reads about their own listing.
  const author = listing.type === "wanted" ? "buyer" : "seller";
  const noDescription = isOwner
    ? `You didn't add a description.${canEdit ? " Edit the listing to add one." : ""}`
    : `The ${author} didn't add a description. Ask them in chat.`;

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: listing.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      // The share sheet was closed: nothing to do.
    }
  };

  // "Message seller" / "Make offer": find or start the chat, then open it (with the offer form).
  const openChat = async (withOffer) => {
    setOpening(withOffer ? "offer" : "message");
    try {
      const { conversation } = await startConversation(listing._id).unwrap();
      navigate(`/inbox/${conversation._id}${withOffer ? "?offer=1" : ""}`);
    } catch (err) {
      toast.error(err.message);
      // It changed meanwhile (reserved, sold, hidden…): show its current state.
      if (err.status === 404 || err.data?.code === "LISTING_UNAVAILABLE") refetch();
      setOpening(null);
    }
  };

  const changeStatus = async (action) => {
    try {
      await updateStatus({ id, status: action.status }).unwrap();
      toast.success(action.done);
    } catch (err) {
      toast.error(err.message);
      refetch();
    }
  };

  const remove = async () => {
    try {
      await deleteListing(id).unwrap();
      setConfirmOpen(false);
      toast.success("Listing deleted");
      navigate("/my-listings", { replace: true });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const details = [
    { label: "Category", value: category?.label, icon: category?.icon },
    condition && { label: "Condition", value: condition.label, hint: condition.hint, icon: CircleCheck },
    { label: "Posted", value: timeAgo(listing.createdAt), icon: Clock },
    { label: "Location", value: formatLocation(listing, me.hostel), icon: MapPin },
    { label: "Views", value: listing.views, icon: Eye },
    { label: "Saved by", value: `${listing.saves} ${listing.saves === 1 ? "student" : "students"}`, icon: Heart },
  ].filter(Boolean);

  return (
    <div className="animate-fade-up space-y-10">
      {/* The invisible ::after box gives thumbs a 44px-tall target without moving anything. */}
      <button
        type="button"
        onClick={goBack}
        className="relative inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 after:absolute after:-inset-x-2 after:-inset-y-3 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
      >
        <ArrowLeft className="size-4" /> Back
      </button>

      {/* Phones: photos → title, price & actions → description. Desktop: two columns, side panel sticks. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-x-8">
        <div className="lg:col-start-1">
          <ImageGallery images={listing.images} title={listing.title} type={listing.type} />
        </div>

        <div className="space-y-6 lg:col-start-1">
          <section className={card}>
            <h2 className="font-bold">About this item</h2>
            <p className="mt-2 whitespace-pre-line text-slate-700 dark:text-slate-300">
              {listing.description || noDescription}
            </p>
            {listing.type === "kit" && (
              <div className="mt-5">
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400">What's in the kit</h3>
                <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {listing.kitItems.map((item) => (
                    <li key={item} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm font-medium dark:bg-slate-800/70">
                      <CircleCheck className="size-4 shrink-0 text-emerald-500" /> {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className={card}>
            <h2 className="font-bold">Details</h2>
            <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {details.map(({ label, value, hint, icon: Icon }) => (
                <div key={label} className="min-w-0">
                  <dt className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                    {Icon && <Icon className="size-3.5" />} {label}
                  </dt>
                  <dd className="mt-1 truncate text-sm font-semibold" title={hint}>
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <aside className="row-start-2 space-y-4 lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          <StatusBanner listing={listing} isOwner={isOwner} myChat={existingChat} loadingMyChat={loadingMyChat} />

          <section className={card}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <TypeBadge type={listing.type} />
                {badge && (
                  <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white uppercase dark:bg-white dark:text-slate-900">
                    {badge}
                  </span>
                )}
              </div>
              {!isOwner && (
                <Menu
                  label="More options for this listing"
                  items={[{ label: "Report listing", icon: Flag, onSelect: () => setReportOpen(true) }]}
                  className="-mt-2 -mr-2 shrink-0"
                />
              )}
            </div>
            <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-balance sm:text-3xl">{listing.title}</h1>
            <PriceBlock listing={listing} />
            <p className="mt-4 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
              <MapPin className="size-4" /> {formatLocation(listing, me.hostel)} · {timeAgo(listing.createdAt)}
            </p>

            {isOwner ? (
              <div className="mt-6 grid grid-cols-2 gap-2">
                <Link to={`/inbox?listing=${listing._id}`} className={buttonClasses({ className: "col-span-2" })}>
                  <MessagesSquare className="size-4" /> View chats about this listing
                </Link>
                {canEdit && (
                  <Link
                    to={`/listings/${listing._id}/edit`}
                    className={buttonClasses({ variant: "secondary", className: halfButtons === 1 ? "col-span-2" : "" })}
                  >
                    <Pencil className="size-4" /> Edit
                  </Link>
                )}
                {statusActions.map((action) => (
                  <Button
                    key={action.status}
                    variant="secondary"
                    loading={updatingStatus}
                    onClick={() => changeStatus(action)}
                    className={halfButtons === 1 ? "col-span-2" : ""}
                  >
                    {action.status === "sold" ? <CircleCheck className="size-4" /> : <RotateCcw className="size-4" />}
                    {action.label}
                  </Button>
                ))}
                {canDelete && (
                  <Button variant="danger-ghost" onClick={() => setConfirmOpen(true)} className="col-span-2">
                    <Trash className="size-4" /> Delete listing
                  </Button>
                )}
              </div>
            ) : (
              <div className="mt-6 space-y-2">
                {state === "active" ? (
                  <>
                    <Button variant="gradient" size="lg" loading={opening === "message"} disabled={Boolean(opening)} onClick={() => openChat(false)} className="w-full">
                      <MessageCircle className="size-5" /> {listing.type === "wanted" ? "Message buyer" : "Message seller"}
                    </Button>
                    <Button variant="secondary" loading={opening === "offer"} disabled={Boolean(opening)} onClick={() => openChat(true)} className="w-full">
                      <OfferIcon className="size-4" /> {offerButton.label}
                    </Button>
                  </>
                ) : (
                  existingChat && (
                    <Link to={`/inbox/${existingChat._id}`} className={buttonClasses({ variant: "secondary", className: "w-full" })}>
                      <MessageCircle className="size-4" /> Open your chat
                    </Link>
                  )
                )}
                <div className="grid grid-cols-2 gap-2">
                  <SaveButton listing={listing} variant="full" />
                  <Button variant="secondary" onClick={share}>
                    <Share2 className="size-4" /> Share
                  </Button>
                </div>
              </div>
            )}
          </section>

          <section className={card}>
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">{isOwner ? "Your listing" : "Listed by"}</h2>
            <div className="mt-3 flex items-center gap-3">
              <Link
                to={`/u/${listing.seller._id}`}
                className="group flex min-w-0 flex-1 items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-500"
              >
                <Avatar name={listing.seller.name} src={listing.seller.avatar?.url} size="lg" />
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-bold group-hover:underline">
                    <span className="truncate">{listing.seller.name}</span> <BadgeCheck className="size-4 shrink-0 text-brand-500" />
                  </p>
                  <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                    {listing.seller.hostel || "On campus"} · joined {formatMonthYear(listing.seller.createdAt)}
                  </p>
                  {listing.seller.trust?.ratingCount > 0 && (
                    <StarRating value={listing.seller.trust.ratingAvg} count={listing.seller.trust.ratingCount} size="sm" className="mt-0.5" />
                  )}
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {sellerStats.activeListings} active {sellerStats.activeListings === 1 ? "listing" : "listings"}
                  </p>
                </div>
              </Link>
              <TrustRing trust={listing.seller.trust} size="md" showLabel />
            </div>
          </section>

          <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-500/30 dark:bg-emerald-500/10">
            <h2 className="flex items-center gap-2 font-bold text-emerald-900 dark:text-emerald-100">
              <ShieldCheck className="size-5" /> Meet at a safe spot
            </h2>
            <p className="mt-1 text-sm text-emerald-800/80 dark:text-emerald-200/80">
              Check the item before you pay. Good places on {me.campus.shortName}:
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {me.campus.safeSpots.map((spot) => (
                <li
                  key={spot._id}
                  className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-500/30"
                >
                  {spot.name}
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold">More in {category?.label}</h2>
          <ListingGrid listings={similar} />
        </section>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this listing?"
        description="It disappears from the feed and from everyone's saved items, and chats about it are closed. This can't be undone."
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={remove}
        onClose={() => setConfirmOpen(false)}
      />
      {!isOwner && (
        <ReportDialog
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          target={{ type: "listing", id: listing._id, name: listing.title }}
        />
      )}
    </div>
  );
}
