import mongoose from "mongoose";
import Deal from "../models/deal.model.js";
import Listing from "../models/listing.model.js";
import Report from "../models/report.model.js";
import User from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import { adminCampusFilter, canAdminCampus, maskEmail } from "../utils/admin.js";
import { inBatches } from "../utils/batch.js";
import { idOf, isPopulated, sameId } from "../utils/ids.js";
import { notify } from "../utils/notify.js";
import { findPageBefore } from "../utils/paginate.js";
import { escapeRegex } from "../utils/regex.js";
import { toCard } from "../utils/listingCards.js";
import { notHidden } from "../utils/listingVisibility.js";
import { toPublicTrust, toPublicUser } from "../utils/publicUser.js";
import { recomputeTrust } from "../utils/trust.js";
import { banUser, removeListing, restoreListing } from "../utils/moderationActions.js";
import { DEAL_STATUS, LISTING_STATUS, MODERATION_STATE, PUBLIC_USER_FIELDS, REPORT_STATUS, ROLES } from "../config/constants.js";

// The admin console. Lists are scoped by ?campus= (adminCampusFilter: the admin's own campus by default);
// a single report, listing or user is checked against its own campus, and anything on a campus the admin
// doesn't manage is a 404, so ids can't be probed. The demo admin login is shared, so it sees masked
// emails and can only act on demo accounts.

const DAY_MS = 24 * 60 * 60 * 1000;

const truncate = (text = "", max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

// What a removed listing's owner reads as the reason, by what it was reported for.
const REMOVAL_REASONS = {
    scam: "Possible scam",
    prohibited: "Not allowed on CampusSwap",
    harassment: "Harassment",
    fake: "Fake or misleading details",
    spam: "Spam",
    other: "Breaks the community rules"
};

// How a warning describes the report, without naming who sent it.
const WARNING_SUBJECTS = { listing: "one of your listings", message: "a message you sent", user: "your account" };
const WARNING_REASONS = {
    scam: "a possible scam",
    prohibited: "something that isn't allowed on CampusSwap",
    harassment: "harassment",
    fake: "fake or misleading details",
    spam: "spam",
    other: "breaking the community rules"
};

// ── Shapes ────────────────────────────────────────────────

// Another student as admins see them: the public fields, plus what decides which actions are open.
const MODERATED_USER_FIELDS = `${PUBLIC_USER_FIELDS} role isBanned isDemo`;

const toModeratedUser = (user) =>
    isPopulated(user)
        ? { ...toPublicUser(user), isAdmin: user.role === ROLES.ADMIN, isBanned: Boolean(user.isBanned), isDemo: Boolean(user.isDemo) }
        : null;

const toCampus = (campus) => (isPopulated(campus) ? { _id: campus._id, shortName: campus.shortName } : null);

// A listing on the admin screens: the usual card (cover photo, status as students see it), plus how it
// was hidden and the start of its description, enough to judge it without opening it.
const toAdminListing = (listing) => {
    const card = toCard(listing);
    return {
        ...card,
        seller: toModeratedUser(listing.seller) ?? idOf(listing.seller),
        campus: toCampus(listing.campus),
        excerpt: truncate(listing.description, 200),
        deleted: Boolean(listing.deletedAt),
        moderation: { ...card.moderation, source: listing.moderation?.source ?? null, at: listing.moderation?.at ?? null }
    };
};

// Populating rows that are already plain objects (findPageBefore is lean) would otherwise fill them with
// full Mongoose documents, which toCard() can't take apart.
const leanPopulate = (paths) => paths.map((path) => ({ ...path, options: { lean: true } }));

// Everything toAdminReport() reads, for Report.populate(rows, REPORT_POPULATE).
const REPORT_POPULATE = leanPopulate([
    { path: "reporter", select: PUBLIC_USER_FIELDS },
    { path: "user", select: MODERATED_USER_FIELDS },
    { path: "listing", select: "seller title description type price rentPeriod images status moderation deletedAt expiresAt rentedUntil createdAt" },
    { path: "message", select: "type text image createdAt" },
    { path: "resolvedBy", select: "name" },
    { path: "campus", select: "shortName" }
]);

// What the admin listing shapes read, for listings loaded without their seller and campus.
const LISTING_POPULATE = leanPopulate([
    { path: "seller", select: MODERATED_USER_FIELDS },
    { path: "campus", select: "shortName" }
]);

// A report with what it points at: the listing's card, or the reported message itself.
const toAdminReport = (report) => ({
    _id: report._id,
    targetType: report.targetType,
    reason: report.reason,
    details: report.details ?? "",
    source: report.source,
    status: report.status,
    action: report.action,
    note: report.note ?? "",
    createdAt: report.createdAt,
    resolvedAt: report.resolvedAt ?? null,
    resolvedBy: isPopulated(report.resolvedBy) ? { _id: report.resolvedBy._id, name: report.resolvedBy.name } : null,
    reporter: isPopulated(report.reporter) ? toPublicUser(report.reporter) : null,
    user: toModeratedUser(report.user),
    listing: report.targetType === "listing" && isPopulated(report.listing) ? toAdminListing(report.listing) : null,
    message: report.targetType === "message" && isPopulated(report.message)
        ? {
            _id: report.message._id,
            type: report.message.type,
            text: truncate(report.message.text, 300),
            image: report.message.image?.url ?? null,
            createdAt: report.message.createdAt
        }
        : null,
    campus: toCampus(report.campus)
});

const toAdminUser = (user, viewer, openReports = 0) => ({
    ...toModeratedUser(user),
    email: viewer.isDemo ? maskEmail(user.email) : user.email,
    campus: toCampus(user.campus),
    trust: toPublicTrust(user.trust),
    reportStats: { filed: user.reportStats?.filed ?? 0, dismissed: user.reportStats?.dismissed ?? 0 },
    openReports,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt ?? null
});

// How many open reports each listing or user (`field`) has, for the counts on the admin lists.
const openReportCounts = async (field, ids) => {
    const rows = await Report.aggregate([
        { $match: { [field]: { $in: ids }, status: REPORT_STATUS.OPEN } },
        { $group: { _id: `$${field}`, count: { $sum: 1 } } }
    ]);
    return new Map(rows.map(({ _id, count }) => [idOf(_id), count]));
};

// ── Loading and checks ────────────────────────────────────

const notFound = (what) => new ApiError(404, `${what} not found`);

const findReportToManage = async (id, admin) => {
    if (!mongoose.isValidObjectId(id)) throw notFound("Report");
    const report = await Report.findById(id).lean();
    if (!report || !canAdminCampus(admin, report.campus)) throw notFound("Report");
    return report;
};

// Listings their owner deleted are gone for moderation too.
const findListingToManage = async (id, admin) => {
    if (!mongoose.isValidObjectId(id)) throw notFound("Listing");
    const listing = await Listing.findById(id).select("seller campus moderation deletedAt").lean();
    if (!listing || listing.deletedAt || !canAdminCampus(admin, listing.campus)) throw notFound("Listing");
    return listing;
};

const findUserToManage = async (id, admin) => {
    if (!mongoose.isValidObjectId(id)) throw notFound("User");
    const user = await User.findById(id).select("role isDemo isBanned campus").lean();
    if (!user || !canAdminCampus(admin, user.campus)) throw notFound("User");
    return user;
};

// The demo admin login is shared publicly, so it may only change what belongs to demo accounts.
const assertDemoReach = (admin, owner) => {
    if (admin.isDemo && !owner?.isDemo) throw new ApiError(403, "Demo admins can only moderate demo accounts", { code: "DEMO_ADMIN" });
};

// Warnings and suspensions: never your own account or another admin's.
const assertCanActOnAccount = (admin, target) => {
    if (!target) throw notFound("User");
    if (sameId(target._id, admin._id)) throw new ApiError(400, "You can't do this to your own account", { code: "SELF_ACTION" });
    if (target.role === ROLES.ADMIN) throw new ApiError(403, "Admins can't be warned or suspended", { code: "ADMIN_TARGET" });
    assertDemoReach(admin, target);
};

// ── Settling reports ──────────────────────────────────────

const decisionFor = (status, action, admin, note = "") => ({
    status,
    action,
    resolvedBy: admin._id,
    resolvedAt: new Date(),
    ...(note && { note })
});

// Closes every open report matching `filter` with one decision. Each is claimed with its own conditional
// update, so a report that two admins close at the same moment is only counted once. Returns them.
const closeReports = async (filter, decision) => {
    const open = await Report.find({ ...filter, status: REPORT_STATUS.OPEN }).select("_id").lean();
    const closed = await inBatches(open, ({ _id }) =>
        Report.findOneAndUpdate({ _id, status: REPORT_STATUS.OPEN }, { $set: decision }, { returnDocument: "after" }).lean()
    );
    return closed.filter(Boolean);
};

// Every reporter hears the same words whatever was decided, and never who else reported it (A11). A
// dismissed report counts against its reporter's record, which weighs their next reports (utils/reports.js).
const thankReporters = async (reports) => {
    const dismissed = reports.filter((report) => report.reporter && report.status === REPORT_STATUS.DISMISSED);
    await inBatches(dismissed, (report) => User.updateOne({ _id: report.reporter }, { $inc: { "reportStats.dismissed": 1 } }));

    const reporters = new Map(reports.filter((report) => report.reporter).map((report) => [idOf(report.reporter), report.reporter]));
    await inBatches([...reporters.values()], (reporterId) =>
        notify(reporterId, {
            type: "report_resolved",
            title: "Thanks — we've reviewed your report",
            body: "A moderator on your campus looked into what you reported. Reports like yours keep CampusSwap safe."
        })
    );
};

// The open reports a decision settles along with the one it was made on: every report about the same
// listing, message or person. A suspension settles every report about that person, since everything
// they had on CampusSwap is wound down with it.
const settledTogether = (report, action) => {
    if (action === "ban_user") return { user: report.user };
    if (report.targetType === "listing") return { targetType: "listing", listing: report.listing };
    if (report.targetType === "message") return { targetType: "message", message: report.message };
    return { targetType: "user", user: report.user };
};

const warnUser = (report) =>
    notify(report.user, {
        type: "account_warning",
        title: "A warning from the CampusSwap moderators",
        body: `A moderator reviewed a report about ${WARNING_SUBJECTS[report.targetType]} (${WARNING_REASONS[report.reason]}) and agreed with it. ` +
            "Please stick to the community rules: repeated problems can get an account suspended.",
        link: report.targetType === "listing" ? `/listings/${report.listing}` : ""
    });

// Each decision: how its reports are closed, whether it needs a listing report or acts on an account,
// what it does, and what the admin is told.
const REPORT_DECISIONS = {
    dismiss: {
        status: REPORT_STATUS.DISMISSED,
        action: "none",
        // Unfounded reports: a listing they hid for review comes back (a removal stays an admin's call).
        apply: (report) => report.listing && restoreListing(report.listing, { onlyIfFlaggedBy: "reports" }),
        message: "Report dismissed"
    },
    remove_listing: {
        status: REPORT_STATUS.RESOLVED,
        action: "listing_removed",
        needsListing: true,
        apply: (report) => removeListing(report.listing, { reason: REMOVAL_REASONS[report.reason] }),
        message: "Listing removed"
    },
    restore_listing: {
        status: REPORT_STATUS.RESOLVED,
        action: "listing_restored",
        needsListing: true,
        apply: (report) => restoreListing(report.listing),
        message: "Listing restored"
    },
    warn_user: {
        status: REPORT_STATUS.RESOLVED,
        action: "user_warned",
        onAccount: true,
        apply: warnUser,
        message: "Warning sent"
    },
    ban_user: {
        status: REPORT_STATUS.RESOLVED,
        action: "user_banned",
        onAccount: true,
        apply: (report) => banUser(report.user),
        message: "Account suspended"
    }
};

// ── Overview ──────────────────────────────────────────────

export const getOverview = async (req, res) => {
    const scope = adminCampusFilter(req.user, req.validatedQuery.campus);
    const now = new Date();
    const since = (days) => new Date(now.getTime() - days * DAY_MS);
    const members = { ...scope, isVerified: true };
    // An active listing past its expiry date already counts as expired, as everywhere else.
    const shownStatus = { $cond: [{ $and: [{ $eq: ["$status", LISTING_STATUS.ACTIVE] }, { $lte: ["$expiresAt", now] }] }, LISTING_STATUS.EXPIRED, "$status"] };

    const [usersTotal, usersNew, statusCounts, flagged, openReports, completed] = await Promise.all([
        User.countDocuments(members),
        User.countDocuments({ ...members, createdAt: { $gte: since(7) } }),
        // Only listings students can see; the ones under review are counted separately.
        Listing.aggregate([{ $match: { ...scope, ...notHidden() } }, { $group: { _id: shownStatus, count: { $sum: 1 } } }]),
        Listing.countDocuments({ ...scope, "moderation.state": MODERATION_STATE.FLAGGED, deletedAt: null }),
        Report.countDocuments({ ...scope, status: REPORT_STATUS.OPEN }),
        Deal.countDocuments({ ...scope, status: DEAL_STATUS.COMPLETED, completedAt: { $gte: since(30) } })
    ]);

    const byStatus = Object.fromEntries(Object.values(LISTING_STATUS).map((status) => [status, 0]));
    for (const { _id, count } of statusCounts) byStatus[_id] = count;

    return res.json({
        success: true,
        users: { total: usersTotal, new7d: usersNew },
        listings: { byStatus, flagged },
        reports: { open: openReports },
        deals: { completed30d: completed }
    });
};

// ── Reports ───────────────────────────────────────────────

// ?status=open|resolved|dismissed, newest first; pages are cursors on createdAt.
export const getReports = async (req, res) => {
    const { campus, status, before, limit } = req.validatedQuery;
    const scope = adminCampusFilter(req.user, campus);

    const { rows, hasMore } = await findPageBefore(Report, { ...scope, status }, { field: "createdAt", before, limit });
    await Report.populate(rows, REPORT_POPULATE);

    return res.json({ success: true, reports: rows.map(toAdminReport), hasMore });
};

// One decision on an open report. It settles the other open reports about the same thing too, thanks
// every reporter and refreshes the reported person's trust score (upheld reports lower it).
export const resolveReport = async (req, res) => {
    const admin = req.user;
    const { action, note } = req.body;
    const decision = REPORT_DECISIONS[action];

    const report = await findReportToManage(req.params.id, admin);
    if (report.status !== REPORT_STATUS.OPEN) throw new ApiError(409, "This report was already handled", { code: "REPORT_CLOSED" });
    if (decision.needsListing && report.targetType !== "listing") {
        throw new ApiError(400, "Only reports about a listing can remove or restore one", { code: "INVALID_ACTION" });
    }

    const [target, listing] = await Promise.all([
        User.findById(report.user).select("role isDemo isBanned").lean(),
        report.listing ? Listing.findById(report.listing).select("deletedAt").lean() : null
    ]);
    if (decision.onAccount) assertCanActOnAccount(admin, target);
    else assertDemoReach(admin, target);
    if (decision.needsListing && (!listing || listing.deletedAt)) {
        throw new ApiError(409, "Its owner deleted this listing", { code: "LISTING_DELETED" });
    }

    // 1. Claim the report: of two admins deciding at the same moment, only one gets past this.
    const closing = decisionFor(decision.status, decision.action, admin, note);
    const claimed = await Report.findOneAndUpdate({ _id: report._id, status: REPORT_STATUS.OPEN }, { $set: closing }, { returnDocument: "after" }).lean();
    if (!claimed) throw new ApiError(409, "This report was already handled", { code: "REPORT_CLOSED" });

    // 2. Carry it out. If that fails halfway, the report opens again so the admin can simply retry (every
    //    step only touches what's still open, so running it twice is safe).
    try {
        await decision.apply(claimed);
    } catch (err) {
        await Report.updateOne(
            { _id: claimed._id, status: claimed.status, resolvedAt: claimed.resolvedAt },
            { $set: { status: REPORT_STATUS.OPEN, action: "none" }, $unset: { note: 1, resolvedBy: 1, resolvedAt: 1 } }
        );
        throw err;
    }

    // 3. The same decision settles the other open reports about it.
    const others = await closeReports(settledTogether(claimed, action), closing);
    await thankReporters([claimed, ...others]);
    await recomputeTrust(claimed.user);

    const shaped = await Report.findById(claimed._id).populate(REPORT_POPULATE).lean();
    return res.json({ success: true, message: decision.message, report: toAdminReport(shaped), closed: others.length + 1 });
};

// ── Listings under review ─────────────────────────────────

// ?moderation=flagged (the review queue) or removed, newest first; pages are cursors on createdAt.
export const getModerationListings = async (req, res) => {
    const { campus, moderation, before, limit } = req.validatedQuery;
    const scope = adminCampusFilter(req.user, campus);

    const { rows, hasMore } = await findPageBefore(
        Listing,
        { ...scope, "moderation.state": moderation, deletedAt: null },
        { field: "createdAt", before, limit }
    );
    await Listing.populate(rows, LISTING_POPULATE);
    const reports = await openReportCounts("listing", rows.map((listing) => listing._id));

    return res.json({
        success: true,
        listings: rows.map((listing) => ({ ...toAdminListing(listing), openReports: reports.get(idOf(listing._id)) ?? 0 })),
        hasMore
    });
};

// What most of a listing's open reports said, in the owner's words, for a removal from the queue.
const removalReasonFor = async (listingId) => {
    const [top] = await Report.aggregate([
        { $match: { targetType: "listing", listing: listingId, status: REPORT_STATUS.OPEN } },
        { $sortByCount: "$reason" },
        { $limit: 1 }
    ]);
    return REMOVAL_REASONS[top?._id] ?? REMOVAL_REASONS.other;
};

// approve: visible again (flagged or removed → ok) · remove: hidden for good. The listing's open reports
// are settled by the same decision. Approving doesn't dismiss them: the owner may have fixed the listing
// since, so the reporters' records stay as they are.
export const moderateListing = async (req, res) => {
    const admin = req.user;
    const approve = req.body.action === "approve";
    const listing = await findListingToManage(req.params.id, admin);
    assertDemoReach(admin, await User.findById(listing.seller).select("isDemo").lean());

    const changed = approve
        ? await restoreListing(listing._id)
        : await removeListing(listing._id, { reason: await removalReasonFor(listing._id) });
    if (!changed) {
        throw new ApiError(409, approve ? "This listing isn't hidden" : "This listing is already removed", { code: "LISTING_UNCHANGED" });
    }

    const closing = decisionFor(REPORT_STATUS.RESOLVED, approve ? "listing_restored" : "listing_removed", admin);
    await thankReporters(await closeReports({ targetType: "listing", listing: listing._id }, closing));
    await recomputeTrust(listing.seller);

    const updated = await Listing.findById(listing._id).populate(LISTING_POPULATE).lean();
    return res.json({ success: true, message: approve ? "Listing approved" : "Listing removed", listing: { ...toAdminListing(updated), openReports: 0 } });
};

// ── Users ─────────────────────────────────────────────────

// Verified accounts, newest first: ?q= (name or email, matched literally) and ?banned=true|false.
export const getUsers = async (req, res) => {
    const admin = req.user;
    const { campus, q, banned, before, limit } = req.validatedQuery;

    const filter = { ...adminCampusFilter(admin, campus), isVerified: true };
    if (banned !== undefined) filter.isBanned = banned ? true : { $ne: true };
    if (q) {
        // Demo admins search names only: with masked emails, they mustn't be able to test whether an address has an account.
        const regex = new RegExp(escapeRegex(q), "i");
        filter.$or = admin.isDemo ? [{ name: regex }] : [{ name: regex }, { email: regex }];
    }

    const { rows, hasMore } = await findPageBefore(User, filter, { field: "createdAt", before, limit });
    await User.populate(rows, leanPopulate([{ path: "campus", select: "shortName" }]));
    const reports = await openReportCounts("user", rows.map((user) => user._id));

    return res.json({ success: true, users: rows.map((user) => toAdminUser(user, admin, reports.get(idOf(user._id)) ?? 0)), hasMore });
};

// { banned: true } suspends the account (utils/moderationActions.js banUser) and, like a suspension from a
// report, settles every open report about them. { banned: false } only lets them log in again: their
// removed listings stay removed.
export const updateUser = async (req, res) => {
    const admin = req.user;
    const { banned } = req.body;
    const target = await findUserToManage(req.params.id, admin);
    assertCanActOnAccount(admin, target);

    if (banned) {
        await banUser(target._id);
        await thankReporters(await closeReports({ user: target._id }, decisionFor(REPORT_STATUS.RESOLVED, "user_banned", admin)));
        await recomputeTrust(target._id);
    } else {
        await User.updateOne({ _id: target._id }, { $set: { isBanned: false } });
    }

    const user = await User.findById(target._id).populate("campus", "shortName").lean();
    const reports = await openReportCounts("user", [user._id]);
    return res.json({
        success: true,
        message: banned ? "Account suspended" : "Suspension lifted",
        user: toAdminUser(user, admin, reports.get(idOf(user._id)) ?? 0)
    });
};
