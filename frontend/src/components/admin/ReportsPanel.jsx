import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Ban, CircleCheck, ExternalLink, Flag, Inbox, RotateCcw, Trash, TriangleAlert } from "lucide-react";
import Avatar from "../ui/Avatar";
import Button, { buttonClasses } from "../ui/Button";
import ConfirmDialog from "../ui/ConfirmDialog";
import EmptyState from "../ui/EmptyState";
import { Textarea } from "../ui/Field";
import TypeBadge from "../listings/TypeBadge";
import { AccountChips, Chip, ListingStateChip, ListingThumb, ListSkeleton, LoadMore, PanelError, Segmented } from "./AdminShared";
import { useGetAdminReportsInfiniteQuery, useResolveReportMutation } from "../../api/admin.api";
import { REPORT_REASONS } from "../../constants/trust";
import { MAX_ADMIN_NOTE_LENGTH, REPORT_OUTCOMES, REPORT_STATUS_FILTERS, REPORT_TARGET_LABELS } from "../../constants/admin";
import { accountBlocker, contentBlocker, groupReports, itemsOf, namesList } from "../../utils/admin";
import { firstName } from "../../utils/deals";
import { formatPrice, timeAgo } from "../../utils/format";
import { listingState } from "../../utils/listing";

const REASON_LABELS = Object.fromEntries(REPORT_REASONS.map((reason) => [reason.value, reason.label]));

const EMPTY = {
  open: { title: "Nothing to review", description: "No open reports right now. When a student reports a listing, a person or a message, it shows up here." },
  resolved: { title: "No decisions yet", description: "Reports you act on (a removal, a warning, a suspension) are kept here." },
  dismissed: { title: "Nothing dismissed", description: "Reports you decide break no rules are kept here." },
};

const OUTCOME_TONES = { none: "slate", listing_removed: "rose", listing_restored: "emerald", user_warned: "amber", user_banned: "rose" };

// What each decision says before it's made, for the newest of `count` reports about one thing. Reporters
// are never told the outcome, only thanked.
const decisionCopy = (action, report, count) => {
  const name = report.user?.name ?? "this student";
  const title = report.listing?.title ?? "this listing";
  const about = { listing: "listing", message: "message", user: "person" }[report.targetType];
  const others = `Every open report about this ${about} closes, and each reporter is thanked.`;

  switch (action) {
    case "dismiss":
      return {
        title: count > 1 ? `Dismiss all ${count} reports?` : "Dismiss this report?",
        description: `Nothing here breaks the rules. Dismissed reports count against whoever sent them.${
          listingState(report.listing ?? {}) === "flagged" ? " The listing becomes visible again." : ""
        } ${others}`,
        confirmLabel: "Dismiss report",
        tone: "brand",
        icon: CircleCheck,
      };
    case "remove_listing":
      return {
        title: `Remove “${title}”?`,
        description: `It's hidden for good. An open deal on it is cancelled (neither side's trust score pays for it), its offers close and ${firstName(name)} is told why. ${others}`,
        confirmLabel: "Remove listing",
        tone: "danger",
        icon: Trash,
      };
    case "restore_listing":
      return {
        title: `Make “${title}” visible again?`,
        description: `It keeps its status: a reserved listing stays reserved. ${firstName(name)} is told. ${others}`,
        confirmLabel: "Restore listing",
        tone: "success",
        icon: RotateCcw,
      };
    case "warn_user":
      return {
        title: `Warn ${name}?`,
        description: `${firstName(name)} gets a warning about this report (without your name or the reporter's), and their trust score drops. ${others}`,
        confirmLabel: "Send warning",
        tone: "brand",
        icon: TriangleAlert,
      };
    default:
      return {
        title: `Suspend ${name}?`,
        description: `${firstName(name)} is logged out everywhere and can't log back in. Their live listings are removed and their open deals and offers are cancelled. Every open report about them closes.`,
        confirmLabel: "Suspend account",
        tone: "danger",
        icon: Ban,
      };
  }
};

// The decisions open on a report, and why any are missing (the server checks the same rules).
const actionsFor = (report, me) => {
  const notes = [];
  const contentNote = contentBlocker(report.user, me);
  if (contentNote) return { actions: [], notes: [contentNote] };

  const actions = [{ action: "dismiss", label: "Dismiss", icon: CircleCheck, variant: "secondary" }];
  const { listing } = report;
  if (report.targetType === "listing") {
    const state = listing ? listingState(listing) : "deleted";
    if (state === "deleted") notes.push("Its owner deleted this listing");
    else if (state === "flagged" || state === "removed") actions.push({ action: "restore_listing", label: "Restore listing", icon: RotateCcw, variant: "secondary" });
    if (state !== "deleted" && state !== "removed") actions.push({ action: "remove_listing", label: "Remove listing", icon: Trash, variant: "danger-ghost" });
  }

  const accountNote = accountBlocker(report.user, me) ?? (report.user.isBanned ? "This account is already suspended" : null);
  if (accountNote) notes.push(accountNote);
  else {
    actions.push(
      { action: "warn_user", label: "Warn", icon: TriangleAlert, variant: "secondary" },
      { action: "ban_user", label: "Suspend", icon: Ban, variant: "danger-ghost" },
    );
  }
  return { actions, notes };
};

const linkClasses = buttonClasses({ variant: "ghost", size: "sm", className: "shrink-0 self-start" });

// What the report is about: the listing's card, the message itself, or the person.
function ReportTarget({ report }) {
  const { listing, message, user } = report;
  const frame = "mt-4 rounded-2xl border border-slate-200 p-3 dark:border-slate-700";

  if (report.targetType === "listing") {
    if (!listing) return <p className={`${frame} text-sm text-slate-500 dark:text-slate-400`}>Its owner deleted this listing.</p>;
    return (
      <div className={`${frame} flex gap-3`}>
        <ListingThumb listing={listing} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <TypeBadge type={listing.type} />
            <ListingStateChip listing={listing} />
          </div>
          <p className="mt-1 truncate font-semibold">{listing.title}</p>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{formatPrice(listing)}</p>
          {user && (
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              Posted by <span className="font-semibold text-slate-700 dark:text-slate-200">{user.name}</span>
              <AccountChips user={user} />
            </p>
          )}
        </div>
        <Link to={`/listings/${listing._id}`} className={linkClasses} aria-label={`Open the listing ${listing.title}`}>
          <ExternalLink className="size-4" aria-hidden /> <span className="hidden sm:inline">Open</span>
        </Link>
      </div>
    );
  }

  if (report.targetType === "message") {
    if (!message) return <p className={`${frame} text-sm text-slate-500 dark:text-slate-400`}>This message no longer exists.</p>;
    return (
      <figure className={frame}>
        <blockquote className="text-sm text-slate-800 [overflow-wrap:anywhere] dark:text-slate-100">
          {message.type === "image" ? `📷 ${message.text || "A photo"}` : `“${message.text}”`}
        </blockquote>
        <figcaption className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          {user && <Avatar name={user.name} src={user.avatar?.url} size="xs" />}
          Sent by <span className="font-semibold text-slate-700 dark:text-slate-200">{user?.name ?? "a former member"}</span> · {timeAgo(message.createdAt)}
          <AccountChips user={user} />
        </figcaption>
      </figure>
    );
  }

  if (!user) return <p className={`${frame} text-sm text-slate-500 dark:text-slate-400`}>This account no longer exists.</p>;
  return (
    <div className={`${frame} flex items-center gap-3`}>
      <Avatar name={user.name} src={user.avatar?.url} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1.5 font-semibold">
          <span className="truncate">{user.name}</span>
          <AccountChips user={user} />
        </p>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user.hostel || "No hostel set"}</p>
      </div>
      {/* A suspended account's profile is gone for everyone. */}
      {!user.isBanned && (
        <Link to={`/u/${user._id}`} className={linkClasses} aria-label={`Open ${user.name}'s profile`}>
          <ExternalLink className="size-4" aria-hidden /> <span className="hidden sm:inline">Profile</span>
        </Link>
      )}
    </div>
  );
}

// Every report about one thing (see groupReports): why they were sent, by whom, what it's about, and the
// decision that settles them all. Actions go through the newest report; the server closes the rest.
function ReportCard({ group, me, showCampus, onDecide }) {
  const { lead: report, reports } = group;
  const isOpen = report.status === "open";
  const { actions, notes } = isOpen ? actionsFor(report, me) : { actions: [], notes: [] };
  const subject = report.listing?.title ?? report.user?.name ?? "this report";
  const reasons = [...new Set(reports.map((item) => item.reason))].map((reason) => [reason, reports.filter((item) => item.reason === reason).length]);
  const reporters = reports.map((item) => item.reporter).filter(Boolean);
  const automatic = reports.length > reporters.length;
  const withDetails = reports.filter((item) => item.details);

  return (
    <li className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {reasons.map(([reason, count]) => (
          <span
            key={reason}
            className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
          >
            <Flag className="size-3.5" aria-hidden /> {REASON_LABELS[reason] ?? reason}
            {count > 1 && <span className="font-semibold">× {count}</span>}
          </span>
        ))}
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          {REPORT_TARGET_LABELS[report.targetType]}
          {reports.length > 1 && ` · ${reports.length} reports`}
        </span>
        {showCampus && report.campus && <Chip>{report.campus.shortName}</Chip>}
        <time dateTime={report.createdAt} className="ml-auto text-xs text-slate-500 dark:text-slate-400">
          {timeAgo(report.createdAt)}
        </time>
      </div>

      <div className="mt-3 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
        {reporters.length > 0 && (
          <span className="flex shrink-0 -space-x-1.5" aria-hidden>
            {reporters.slice(0, 3).map((reporter) => (
              <Avatar key={reporter._id} name={reporter.name} src={reporter.avatar?.url} size="xs" className="ring-2 ring-white dark:ring-slate-900" />
            ))}
          </span>
        )}
        <p className="min-w-0">
          {reporters.length > 0 ? (
            <>
              Reported by{" "}
              <span className="font-semibold text-slate-800 dark:text-slate-100">{namesList(reporters.map((reporter) => reporter.name))}</span>
              {automatic && " and flagged automatically"}
            </>
          ) : (
            "Flagged automatically"
          )}
        </p>
      </div>
      {withDetails.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {withDetails.map((item) => (
            <li key={item._id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700 [overflow-wrap:anywhere] dark:bg-slate-800/70 dark:text-slate-200">
              “{item.details}”
              {reports.length > 1 && item.reporter && <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">— {firstName(item.reporter.name)}</span>}
            </li>
          ))}
        </ul>
      )}

      <ReportTarget report={report} />

      {isOpen ? (
        (actions.length > 0 || notes.length > 0) && (
          <div className="mt-4 space-y-2">
            {actions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {actions.map(({ action, label, icon: Icon, variant }) => (
                  <Button key={action} size="sm" variant={variant} onClick={() => onDecide(group, action)} aria-label={`${label}: ${subject}`}>
                    <Icon className="size-4" aria-hidden /> {label}
                  </Button>
                ))}
              </div>
            )}
            {notes.map((note) => (
              <p key={note} className="text-xs text-slate-500 dark:text-slate-400">
                {note}.
              </p>
            ))}
          </div>
        )
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <Chip tone={OUTCOME_TONES[report.action]}>{REPORT_OUTCOMES[report.action] ?? report.action}</Chip>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            by {report.resolvedBy?.name ?? "an admin"}
            {report.resolvedAt && ` · ${timeAgo(report.resolvedAt)}`}
          </span>
          {report.note && (
            <p className="basis-full rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700 italic [overflow-wrap:anywhere] dark:bg-slate-800/70 dark:text-slate-200">
              Note: {report.note}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

// The decision being confirmed, with an optional note that only other admins see.
function DecisionDialog({ pending, onClose }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState(null);
  const [resolveReport, { isLoading }] = useResolveReportMutation();
  const copy = pending ? decisionCopy(pending.action, pending.report, pending.count) : null;

  const close = () => {
    setNote("");
    setError(null);
    onClose();
  };

  const confirm = async () => {
    try {
      const result = await resolveReport({ id: pending.report._id, action: pending.action, note: note.trim() }).unwrap();
      close();
      const more = result.closed - 1;
      toast.success(more > 0 ? `${result.message} · ${more} more ${more === 1 ? "report" : "reports"} closed` : result.message);
    } catch (err) {
      if (err.data?.errors?.note) {
        setError(err.data.errors.note);
      } else {
        // Nothing to fix in the form (another admin decided first, say): close first, because toasts
        // are drawn underneath an open dialog.
        close();
        toast.error(err.message);
      }
    }
  };

  return (
    <ConfirmDialog
      open={Boolean(pending)}
      title={copy?.title ?? ""}
      description={copy?.description}
      confirmLabel={copy?.confirmLabel}
      tone={copy?.tone}
      icon={copy?.icon}
      loading={isLoading}
      onConfirm={confirm}
      onClose={close}
    >
      <Textarea
        label="Note for other admins (optional)"
        hint="Kept with the decision. The people involved never see it."
        value={note}
        onChange={(event) => {
          setNote(event.target.value);
          setError(null);
        }}
        maxLength={MAX_ADMIN_NOTE_LENGTH}
        rows={2}
        placeholder="e.g. Same photos as an OLX ad"
        error={error}
        disabled={isLoading}
      />
    </ConfirmDialog>
  );
}

// The report queue: open reports to decide on, and the decisions already made.
export default function ReportsPanel({ campus, me }) {
  const [status, setStatus] = useState("open");
  const [pending, setPending] = useState(null); // { report, count, action } while its dialog is open
  const query = useGetAdminReportsInfiniteQuery({ campus, status });
  const { data, isLoading, isError, error, refetch, isFetching, isFetchingNextPage } = query;
  const groups = useMemo(() => groupReports(itemsOf(data, "reports")), [data]);

  let content;
  if (isError && !data) content = <PanelError title="Couldn't load the reports" error={error} onRetry={refetch} />;
  else if (isLoading) content = <ListSkeleton />;
  else if (groups.length === 0) content = <EmptyState icon={Inbox} {...EMPTY[status]} />;
  else {
    content = (
      <>
        <ul className="space-y-3">
          {groups.map((group) => (
            <ReportCard
              key={group.key}
              group={group}
              me={me}
              showCampus={campus === "all"}
              onDecide={(decided, action) => setPending({ report: decided.lead, count: decided.reports.length, action })}
            />
          ))}
        </ul>
        <LoadMore query={query} label="Load more reports" />
      </>
    );
  }

  return (
    <div className="space-y-4" aria-busy={isFetching && !isFetchingNextPage}>
      <Segmented label="Report status" options={REPORT_STATUS_FILTERS} value={status} onChange={setStatus} />
      {content}
      <DecisionDialog pending={pending} onClose={() => setPending(null)} />
    </div>
  );
}
