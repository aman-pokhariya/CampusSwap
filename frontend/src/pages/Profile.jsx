import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { toast } from "sonner";
import { BadgeCheck, CalendarDays, MapPin, Pencil, SearchX, Store } from "lucide-react";
import ListingGrid from "../components/listings/ListingGrid";
import BadgeList from "../components/trust/BadgeList";
import ReviewItem from "../components/trust/ReviewItem";
import StarRating from "../components/trust/StarRating";
import TrustRing from "../components/trust/TrustRing";
import UserActionsMenu from "../components/trust/UserActionsMenu";
import Alert from "../components/ui/Alert";
import Avatar from "../components/ui/Avatar";
import Button, { buttonClasses } from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import Skeleton from "../components/ui/Skeleton";
import { useGetProfileQuery } from "../api/listings.api";
import { useGetUserReviewsInfiniteQuery, useUnblockUserMutation } from "../api/trust.api";
import { formatMonthYear } from "../utils/format";
import { isNewMember, trustLevel, trustScore } from "../utils/trust";

const card = "rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900";

// The trust score ring (or "New member"), the stars, and what the score is made of.
function TrustSummary({ trust }) {
  const fresh = isNewMember(trust);

  return (
    <div className="mt-5 flex items-center gap-4 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
      <TrustRing trust={trust} size="lg" />
      <div className="min-w-0 space-y-1">
        <p className="font-bold">{fresh ? "New member" : `Trust score · ${trustLevel(trustScore(trust)).label}`}</p>
        {trust?.ratingCount > 0 ? (
          <StarRating value={trust.ratingAvg} count={trust.ratingCount} />
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">No reviews yet</p>
        )}
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {fresh
            ? "No finished deals yet. The score shows up after the first handover."
            : "Grows with finished deals, good reviews and time on CampusSwap."}
        </p>
      </div>
    </div>
  );
}

// Shown to the one who blocked: what the block does, and the way to undo it.
function BlockedNotice({ user, firstName }) {
  const [unblockUser, { isLoading }] = useUnblockUserMutation();

  const unblock = async () => {
    try {
      await unblockUser(user._id).unwrap();
      toast.success(`${firstName} is unblocked`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <Alert type="warning" title={`You blocked ${firstName}`}>
      <p>You can't message each other or make offers, and you don't see each other's listings.</p>
      <Button size="sm" variant="secondary" onClick={unblock} loading={isLoading} className="mt-3">
        Unblock {firstName}
      </Button>
    </Alert>
  );
}

// The newest reviews come with the profile; "Show more" pages back from the last of them.
function ReviewsSection({ userId, firstName, isMe, reviews, hasMore }) {
  const [expanded, setExpanded] = useState(false);
  const before = reviews.at(-1)?.createdAt;
  const { data, isFetching, isError, isFetchNextPageError, hasNextPage, fetchNextPage, refetch } = useGetUserReviewsInfiniteQuery(
    { userId, before },
    { skip: !expanded || !before },
  );

  const shown = useMemo(() => {
    const seen = new Set();
    return [...reviews, ...(data?.pages ?? []).flatMap((page) => page.reviews)].filter((review) => !seen.has(review._id) && seen.add(review._id));
  }, [reviews, data]);

  const canShowMore = expanded ? hasNextPage : hasMore;
  const failed = expanded && isError && !isFetching;
  const showMore = () => (expanded ? fetchNextPage() : setExpanded(true));

  return (
    <section className={card} aria-labelledby="reviews-title">
      <h2 id="reviews-title" className="text-xl font-bold">
        Reviews
      </h2>
      {shown.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {isMe
            ? "Reviews from the people you deal with show up here, after each handover."
            : `${firstName} has no reviews yet. Reviews can only be left after a finished deal.`}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
          {shown.map((review) => (
            <li key={review._id} className="py-4 first:pt-0 last:pb-0">
              <ReviewItem review={review} />
            </li>
          ))}
        </ul>
      )}

      {failed ? (
        <p className="mt-4 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
          Couldn't load more reviews ·
          <button
            type="button"
            onClick={() => (isFetchNextPageError ? fetchNextPage() : refetch())}
            className="font-semibold text-brand-600 hover:underline dark:text-brand-400"
          >
            Retry
          </button>
        </p>
      ) : (
        canShowMore && (
          <Button variant="secondary" size="sm" onClick={showMore} loading={expanded && isFetching} className="mt-4 w-full sm:w-auto">
            Show more reviews
          </Button>
        )
      )}
    </section>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading profile">
      <Skeleton className="h-80 rounded-3xl" />
      <Skeleton className="h-32 rounded-3xl" />
      <ListingGrid listings={[]} loading skeletons={4} />
    </div>
  );
}

export default function Profile() {
  const { id } = useParams();
  const me = useSelector((state) => state.auth.user);
  const { data, isLoading, isError, error } = useGetProfileQuery(id);
  const isMe = id === me._id;

  if (isLoading) return <ProfileSkeleton />;

  // A failed background refetch keeps the profile on screen; only nothing at all is an error.
  if (isError && !data) {
    return (
      <EmptyState
        icon={SearchX}
        title={error.status === 404 ? "Profile not found" : "Couldn't load this profile"}
        description={error.status === 404 ? "This student isn't on your campus, or the account no longer exists." : error.message}
        action={<Link to="/home" className={buttonClasses({ variant: "secondary" })}>Back to Explore</Link>}
      />
    );
  }

  const { profile, stats, listings, badges = [], reviews = [], hasMoreReviews = false, blockedByMe = false } = data;
  const firstName = profile.name.split(" ")[0];
  const statItems = [
    { label: "Active listings", value: stats.activeListings },
    { label: "Sold", value: stats.soldListings },
    { label: "Deals done", value: stats.completedDeals ?? 0 },
  ];

  return (
    <div className="animate-fade-up space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="h-24 bg-linear-to-r from-brand-600 via-violet-600 to-fuchsia-600 sm:h-32" />
        <div className="px-5 pb-6 sm:px-8">
          <div className="-mt-12 flex flex-wrap items-end justify-between gap-4 sm:-mt-14">
            <Avatar name={profile.name} src={profile.avatar?.url} size="2xl" className="ring-4 ring-white dark:ring-slate-900" />
            {isMe ? (
              <Link to="/settings" className={buttonClasses({ variant: "secondary", size: "sm" })}>
                <Pencil className="size-4" /> Edit profile
              </Link>
            ) : (
              <UserActionsMenu user={profile} blockedByMe={blockedByMe} />
            )}
          </div>

          <h1 className="mt-4 flex items-center gap-2 text-2xl font-extrabold tracking-tight [overflow-wrap:anywhere]">
            {profile.name} <BadgeCheck className="size-6 shrink-0 text-brand-500" aria-label="Verified student" />
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" /> {profile.hostel || "On campus"} · {profile.campus.shortName}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" /> Joined {formatMonthYear(profile.createdAt)}
            </span>
          </p>
          {profile.bio && <p className="mt-3 max-w-2xl text-slate-700 [overflow-wrap:anywhere] dark:text-slate-300">{profile.bio}</p>}

          <div className="grid grid-cols-1 gap-x-8 lg:grid-cols-[minmax(0,26rem)_auto] lg:items-end">
            <TrustSummary trust={profile.trust} />
            <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
              {statItems.map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</dt>
                  <dd className="text-xl font-extrabold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {blockedByMe && <BlockedNotice user={profile} firstName={firstName} />}

      <section className={card} aria-labelledby="badges-title">
        <h2 id="badges-title" className="text-xl font-bold">
          Badges
        </h2>
        <p className="mt-1 mb-4 text-sm text-slate-500 dark:text-slate-400">Earned through real deals on campus. Each one says how.</p>
        <BadgeList badges={badges} />
      </section>

      <ReviewsSection userId={profile._id} firstName={firstName} isMe={isMe} reviews={reviews} hasMore={hasMoreReviews} />

      <section className="space-y-4 pt-2">
        <h2 className="text-xl font-bold">{isMe ? "Your listings" : `${firstName}'s listings`}</h2>
        {listings.length === 0 ? (
          <EmptyState
            icon={Store}
            title={
              isMe
                ? "You have no active listings"
                : blockedByMe
                  ? `${firstName}'s listings are hidden while they're blocked`
                  : `${firstName} has nothing for sale right now`
            }
            action={
              isMe && (
                <Link to="/sell" className={buttonClasses({ variant: "gradient" })}>
                  Post a listing
                </Link>
              )
            }
          />
        ) : (
          <ListingGrid listings={listings} />
        )}
      </section>
    </div>
  );
}
