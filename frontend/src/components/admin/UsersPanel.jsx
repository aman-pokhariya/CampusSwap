import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Ban, Search, SearchX, UserRoundCheck, Users } from "lucide-react";
import Avatar from "../ui/Avatar";
import Button from "../ui/Button";
import ConfirmDialog from "../ui/ConfirmDialog";
import EmptyState from "../ui/EmptyState";
import { Input, Select } from "../ui/Field";
import { AccountChips, Chip, ListSkeleton, LoadMore, PanelError } from "./AdminShared";
import { useGetAdminUsersInfiniteQuery, useSetUserBannedMutation } from "../../api/admin.api";
import { BANNED_FILTERS } from "../../constants/admin";
import { accountBlocker, itemsOf } from "../../utils/admin";
import { firstName } from "../../utils/deals";
import { formatMonthYear } from "../../utils/format";
import { trustLevel, trustScore } from "../../utils/trust";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";

const TRUST_TONES = { high: "emerald", mid: "slate", low: "rose" };

const decisionCopy = (user) => {
  const name = firstName(user.name);
  if (user.isBanned) {
    return {
      title: `Lift ${user.name}'s suspension?`,
      description: `${name} can log in again. Listings that were removed when the account was suspended stay removed.`,
      confirmLabel: "Lift suspension",
      tone: "brand",
      icon: UserRoundCheck,
    };
  }
  return {
    title: `Suspend ${user.name}?`,
    description: `${name} is logged out everywhere and can't log back in. Their live listings are removed, their open deals and offers are cancelled (nobody else's trust score pays for it), and every open report about them closes.`,
    confirmLabel: "Suspend account",
    tone: "danger",
    icon: Ban,
  };
};

function UserRow({ user, me, showCampus, onToggle }) {
  const blocker = accountBlocker(user, me);
  const { filed, dismissed } = user.reportStats;
  const details = [user.hostel, showCampus && user.campus?.shortName, `Joined ${formatMonthYear(user.createdAt)}`].filter(Boolean);
  // The number itself, even for new members (students see "New member" until there's a deal or a review):
  // upheld reports lower it from day one.
  const score = trustScore(user.trust);
  const level = trustLevel(score);

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:flex-row md:items-center dark:border-slate-800 dark:bg-slate-900">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={user.name} src={user.avatar?.url} />
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5 font-semibold">
            <span className="min-w-0 truncate">{user.name}</span>
            <AccountChips user={user} />
          </p>
          <p className="truncate text-sm text-slate-600 dark:text-slate-300">{user.email}</p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{details.join(" · ")}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
        <Chip tone={TRUST_TONES[level.tone]}>
          Trust {score} · {level.label}
        </Chip>
        <span>
          Reports sent: {filed}
          {dismissed > 0 && ` (${dismissed} dismissed)`}
        </span>
        {user.openReports > 0 && (
          <Chip tone="rose">
            {user.openReports} open {user.openReports === 1 ? "report" : "reports"} about them
          </Chip>
        )}
      </div>

      <div className="md:w-40 md:shrink-0 md:text-right">
        {blocker ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">{blocker}</p>
        ) : (
          <Button
            size="sm"
            variant={user.isBanned ? "secondary" : "danger-ghost"}
            onClick={() => onToggle(user)}
            aria-label={user.isBanned ? `Lift ${user.name}'s suspension` : `Suspend ${user.name}`}
          >
            {user.isBanned ? <UserRoundCheck className="size-4" aria-hidden /> : <Ban className="size-4" aria-hidden />}
            {user.isBanned ? "Lift suspension" : "Suspend"}
          </Button>
        )}
      </div>
    </li>
  );
}

// Every verified account on the campus: search by name (or email), filter suspended ones, suspend or
// lift a suspension.
export default function UsersPanel({ campus, me }) {
  const [search, setSearch] = useState("");
  const [banned, setBanned] = useState("");
  const [pending, setPending] = useState(null); // the user whose dialog is open
  const q = useDebouncedValue(search.trim(), 300);
  const query = useGetAdminUsersInfiniteQuery({ campus, q: q || undefined, banned: banned || undefined });
  const { data, isLoading, isError, error, refetch, isFetching, isFetchingNextPage } = query;
  const users = useMemo(() => itemsOf(data, "users"), [data]);
  const [setUserBanned, { isLoading: saving }] = useSetUserBannedMutation();
  const copy = pending ? decisionCopy(pending) : null;

  // The dialog closes before any toast: toasts are drawn underneath an open dialog.
  const confirm = async () => {
    try {
      const { message } = await setUserBanned({ id: pending._id, banned: !pending.isBanned }).unwrap();
      setPending(null);
      toast.success(message);
    } catch (err) {
      setPending(null);
      toast.error(err.message);
    }
  };

  let content;
  if (isError && !data) content = <PanelError title="Couldn't load the accounts" error={error} onRetry={refetch} />;
  else if (isLoading) content = <ListSkeleton />;
  else if (users.length === 0) {
    content = q ? (
      <EmptyState icon={SearchX} title="No one found" description={`Nobody matches “${q}”. Check the spelling, or try part of the name.`} />
    ) : (
      <EmptyState icon={Users} title="No accounts here" description="Nobody matches this filter yet." />
    );
  } else {
    content = (
      <>
        <ul className="space-y-3">
          {users.map((user) => (
            <UserRow key={user._id} user={user} me={me} showCampus={campus === "all"} onToggle={setPending} />
          ))}
        </ul>
        <LoadMore query={query} label="Load more accounts" />
      </>
    );
  }

  return (
    <div className="space-y-4" aria-busy={isFetching && !isFetchingNextPage}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_14rem]">
        <Input
          label="Search"
          type="search"
          icon={Search}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={me.isDemo ? "Name" : "Name or email"}
          maxLength={80}
          hint={me.isDemo ? "Demo admins search by name, and emails are partly hidden." : undefined}
        />
        <Select label="Show" value={banned} onChange={(event) => setBanned(event.target.value)}>
          {BANNED_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>
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
