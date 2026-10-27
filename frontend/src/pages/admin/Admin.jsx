import { useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { Building, FlaskConical } from "lucide-react";
import Alert from "../../components/ui/Alert";
import CountBadge from "../../components/ui/CountBadge";
import { Select } from "../../components/ui/Field";
import AdminOverview from "../../components/admin/AdminOverview";
import ReportsPanel from "../../components/admin/ReportsPanel";
import FlaggedListingsPanel from "../../components/admin/FlaggedListingsPanel";
import UsersPanel from "../../components/admin/UsersPanel";
import { useGetAdminOverviewQuery, useGetCampusesQuery } from "../../api/admin.api";
import { ADMIN_TABS } from "../../constants/admin";

// /admin?tab=overview|reports|listings|users, plus &campus=<id>|all for global admins. Campus admins
// always see their own campus. The tab and campus live in the URL, so a reload keeps them.
export default function Admin() {
  const me = useSelector((state) => state.auth.user);
  const [params, setParams] = useSearchParams();
  const tabRefs = useRef([]);
  const tab = ADMIN_TABS.some((option) => option.value === params.get("tab")) ? params.get("tab") : "overview";
  const isGlobal = me.adminScope === "global";
  // undefined = the admin's own campus (the server's default).
  const campus = isGlobal ? params.get("campus") || undefined : undefined;

  const overview = useGetAdminOverviewQuery(campus);
  const { data: campusData } = useGetCampusesQuery(undefined, { skip: !isGlobal });
  const campuses = campusData?.campuses ?? [me.campus];
  const scopeName = campus === "all" ? "every campus" : (campuses.find((c) => c._id === (campus ?? me.campus._id))?.shortName ?? me.campus.shortName);
  const counts = { reports: overview.data?.reports.open ?? 0, flagged: overview.data?.listings.flagged ?? 0 };

  const update = (key, value) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  const selectTab = (value) => update("tab", value === "overview" ? null : value);
  const selectCampus = (value) => update("campus", value === me.campus._id ? null : value);

  // Arrow keys move between tabs (the usual tablist keyboard pattern).
  const handleTabKeyDown = (event, index) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + ADMIN_TABS.length) % ADMIN_TABS.length;
    selectTab(ADMIN_TABS[next].value);
    tabRefs.current[next]?.focus();
  };

  const panels = {
    overview: <AdminOverview query={overview} onOpenTab={selectTab} />,
    reports: <ReportsPanel campus={campus} me={me} />,
    listings: <FlaggedListingsPanel campus={campus} me={me} />,
    users: <UsersPanel campus={campus} me={me} />,
  };

  return (
    <div className="animate-fade-up space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Admin</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">Reports, listings under review and accounts on {scopeName}.</p>
        </div>
        {isGlobal && (
          <Select
            label="Campus"
            icon={Building}
            value={campus ?? me.campus._id}
            onChange={(event) => selectCampus(event.target.value)}
            className="w-full sm:w-72"
          >
            <option value="all">All campuses</option>
            {campuses.map((option) => (
              <option key={option._id} value={option._id}>
                {option.name}
              </option>
            ))}
          </Select>
        )}
      </header>

      {me.isDemo && (
        <Alert type="info" title="You're using the demo admin account">
          <span className="inline-flex items-center gap-1.5">
            <FlaskConical className="size-3.5 shrink-0" aria-hidden /> Look around freely: you can only act on demo accounts, and emails are partly hidden.
          </span>
        </Alert>
      )}

      {/* Two rows of two on phones, one row from sm up. */}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 sm:flex sm:w-fit dark:bg-slate-800/70" role="tablist" aria-label="Admin sections">
        {ADMIN_TABS.map(({ value, label, shortLabel, count }, index) => (
          <button
            key={value}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`admin-tab-${value}`}
            aria-selected={tab === value}
            aria-controls="admin-panel"
            tabIndex={tab === value ? 0 : -1}
            onClick={() => selectTab(value)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap transition focus-visible:outline-2 focus-visible:outline-brand-500 sm:px-4 ${
              tab === value
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <span className="sm:hidden">{shortLabel}</span>
            <span className="hidden sm:inline">{label}</span>
            {count && counts[count] > 0 && (
              <>
                <CountBadge count={counts[count]} />
                <span className="sr-only">({counts[count]} waiting)</span>
              </>
            )}
          </button>
        ))}
      </div>

      <div id="admin-panel" role="tabpanel" aria-labelledby={`admin-tab-${tab}`}>
        {panels[tab]}
      </div>
    </div>
  );
}
