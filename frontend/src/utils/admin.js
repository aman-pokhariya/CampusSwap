// The rules the server applies to moderation decisions (backend controllers/admin.controllers.js), so the
// console only offers what will work. Each returns why an action isn't possible, or null when it is.

const DEMO_ONLY = "Demo admins can only act on demo accounts";

// Anything that changes someone's listing or report: the shared demo admin login only reaches demo accounts.
export const contentBlocker = (owner, me) => (me.isDemo && !owner?.isDemo ? DEMO_ONLY : null);

// Warning or suspending: never yourself or another admin.
export const accountBlocker = (user, me) => {
  if (!user) return "This account no longer exists";
  if (user._id === me._id) return "That's your own account";
  if (user.isAdmin) return "Admins can't be warned or suspended";
  return contentBlocker(user, me);
};

// The items of a paged admin list, each once (`key`: "reports", "listings" or "users").
export const itemsOf = (data, key) => {
  const seen = new Set();
  return (data?.pages ?? []).flatMap((page) => page[key]).filter((item) => !seen.has(item._id) && seen.add(item._id));
};

// One decision settles every open report about the same listing, message or person, so the queue shows
// them as one card: { key, lead (the newest), reports }. Closed reports are grouped by the decision that
// closed them, which stamps them all with the same resolvedAt. `reports` come newest first.
export const groupReports = (reports) => {
  const groups = new Map();
  for (const report of reports) {
    const target = report.listing?._id ?? report.message?._id ?? (report.targetType === "user" ? report.user?._id : null) ?? report._id;
    const key = [report.targetType, target, report.status === "open" ? "" : report.resolvedAt].join(":");
    const group = groups.get(key);
    if (group) group.reports.push(report);
    else groups.set(key, { key, lead: report, reports: [report] });
  }
  return [...groups.values()];
};

// "Riya Kapoor", "Riya Kapoor and Dev Mehta", "Riya Kapoor, Dev Mehta and 3 others".
export const namesList = (names) => {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length <= 3) return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} others`;
};
