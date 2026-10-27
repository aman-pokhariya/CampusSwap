// Fills the demo campus (CampusSwap Demo University, @campusswap.dev emails) with a lived-in marketplace:
// students in every hostel, listings of all six types, chats, offers, an open deal with a meetup, finished
// deals with reviews, saves, notifications and a report for the admin. Every account it creates is a demo
// account, so the demo restrictions apply (no password, name, bio or photo changes).
//
// Usage: npm run seed:demo                             refuses when the demo data is already there
//        npm run seed:demo -- --reset                  deletes the demo accounts and everything they own or
//                                                      take part in, then seeds everything again
//        npm run seed:demo -- --admin-password <pw>    the demo admin's password (otherwise a random one)
// Run npm run seed first: it creates the demo campus and builds the indexes.
import crypto from "crypto";
import mongoose from "mongoose";
import { parseArgs } from "util";
import connectDB from "../config/db.js";
import Block from "../models/block.model.js";
import Campus from "../models/campus.model.js";
import Conversation from "../models/conversation.model.js";
import Deal from "../models/deal.model.js";
import Listing from "../models/listing.model.js";
import ListingView from "../models/listingView.model.js";
import Message from "../models/message.model.js";
import Notification from "../models/notification.model.js";
import Offer from "../models/offer.model.js";
import Otp from "../models/otp.model.js";
import Report from "../models/report.model.js";
import Review from "../models/review.model.js";
import Save from "../models/save.model.js";
import User from "../models/user.model.js";
import { toPoint } from "../models/schemas/point.schema.js";
import { passwordField } from "../validators/common.validators.js";
import { listingSchema } from "../validators/listing.validators.js";
import { offerSchema } from "../validators/offer.validators.js";
import { reviewSchema } from "../validators/deal.validators.js";
import { reportSchema } from "../validators/report.validators.js";
import { postMessage } from "../utils/chat.js";
import { claimListingTerms } from "../utils/listingTerms.js";
import { notify } from "../utils/notify.js";
import { countsTowardFlag } from "../utils/reports.js";
import { releaseListing, reserveListing } from "../utils/reservations.js";
import { chatRoleOf, counterpartOf, dealRoleOf, dealRoles, otherDealRole } from "../utils/roles.js";
import { deleteImages } from "../utils/storage.js";
import { recomputeTrust } from "../utils/trust.js";
import {
    chatLink,
    closeListingNegotiations,
    coverOf,
    dealLink,
    describeTerms,
    firstName,
    offerExpiry,
    offerTerms
} from "../utils/offers.js";
import { admin as adminData, listings as listingData, people as peopleData, saves as saveData } from "../seed/demo.data.js";
import {
    ADMIN_SCOPE,
    DEAL_STATUS,
    HANDOVER_TTL_MINUTES,
    LISTING_LIFETIME_DAYS,
    LISTING_STATUS,
    OFFER_STATUS,
    RENT_PERIOD_DAYS,
    REPORT_STATUS,
    ROLES,
    UPHELD_REPORT_ACTIONS
} from "../config/constants.js";

// The password of the two public demo logins (buyer@ and seller@). It's shared openly, which is why
// demo accounts are restricted.
const DEMO_PASSWORD = "Demo@1234";
const DEMO_CAMPUS_SLUG = "demo";
const USAGE = "Usage: npm run seed:demo -- [--reset] [--admin-password <password>]";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const IST_OFFSET_MS = 5.5 * HOUR_MS;

const stop = async (message) => {
    console.error(`\n❌ ${message}\n`);
    await mongoose.disconnect();
    process.exit(1);
};

// ── Clock ─────────────────────────────────────────────────
// Everything happens relative to now, so the demo always looks recent, whenever it's (re)seeded.

const hoursAgo = (hours) => new Date(Date.now() - hours * HOUR_MS);
const daysAgo = (days) => hoursAgo(days * 24);

// `days` from today (negative = in the past) at a time of day in India: on(-3, "19:05").
const on = (days, time) => {
    const [hours, minutes] = time.split(":").map(Number);
    const india = new Date(Date.now() + IST_OFFSET_MS); // today's date in India, read with the UTC getters
    return new Date(Date.UTC(india.getUTCFullYear(), india.getUTCMonth(), india.getUTCDate() + days, hours, minutes) - IST_OFFSET_MS);
};

// "Tue, 5 Nov, 5:30 pm", like the meetup notifications in deal.controllers.js.
const meetupTime = (at) =>
    at.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

// ── Reset ─────────────────────────────────────────────────

// Demo accounts are only ever these: on the demo campus, with an @campusswap.dev email, flagged isDemo.
// A student who signed up there normally (isDemo false) is never touched.
const demoUserFilter = (campus) => ({ campus: campus._id, email: /@campusswap\.dev$/i, isDemo: true });

// Deletes every demo account and everything they own or take part in: their listings (and the chats,
// offers, deals, reviews, reports, saves and views about those), their chats with anyone, their reviews,
// reports, saves, notifications, blocks and codes. Nothing else is deleted. Where other people's data
// pointed at demo data, it's corrected the way the app would: a reservation a demo deal held is released,
// save counters go back down, and trust scores that counted something deleted here are recomputed.
const resetDemoData = async (campus) => {
    const users = await User.find(demoUserFilter(campus)).select("email").lean();
    if (users.length === 0) {
        console.log("🧹 No demo accounts to remove.");
        return;
    }
    const userIds = users.map((user) => user._id);
    const isDemoUser = (id) => userIds.some((userId) => userId.equals(id));
    const mine = { $in: userIds };

    const listings = await Listing.find({ seller: mine }).select("images").lean();
    const listingIds = listings.map((listing) => listing._id);
    const ours = { $in: listingIds };

    const [conversations, deals] = await Promise.all([
        Conversation.find({ $or: [{ participants: mine }, { listing: ours }] }).select("_id").lean(),
        Deal.find({ $or: [{ buyer: mine }, { seller: mine }, { listing: ours }] }).select("listing buyer seller status isOpen cancelledBy").lean()
    ]);
    const conversationIds = conversations.map((conversation) => conversation._id);
    const dealIds = deals.map((deal) => deal._id);

    const messages = await Message.find({ conversation: { $in: conversationIds } }).select("image").lean();
    const messageIds = messages.map((message) => message._id);
    const [reviews, reports, outsideSaves] = await Promise.all([
        Review.find({ $or: [{ reviewer: mine }, { reviewee: mine }, { deal: { $in: dealIds } }] }).select("reviewee").lean(),
        Report.find({ $or: [{ reporter: mine }, { user: mine }, { listing: ours }, { message: { $in: messageIds } }] }).select("user status action").lean(),
        Save.aggregate([{ $match: { user: mine, listing: { $nin: listingIds } } }, { $group: { _id: "$listing", count: { $sum: 1 } } }])
    ]);

    // Someone else's listing reserved by a demo deal goes back on sale (only that deal's reservation).
    for (const deal of deals.filter((d) => d.isOpen && !listingIds.some((id) => id.equals(d.listing)))) {
        await releaseListing(deal.listing, deal._id);
    }
    for (const { _id, count } of outsideSaves) {
        await Listing.updateOne({ _id }, { $inc: { saves: -count } }, { timestamps: false });
    }

    // Notifications about anything deleted here: links to its listings, chats and deals.
    const links = [
        ...listingIds.map((id) => `/listings/${id}`),
        ...conversationIds.map((id) => chatLink(id)),
        ...dealIds.map((id) => dealLink(id))
    ];
    const deletions = [
        ["listings", Listing, { _id: ours }],
        ["chats", Conversation, { _id: { $in: conversationIds } }],
        ["messages", Message, { _id: { $in: messageIds } }],
        ["offers", Offer, { $or: [{ conversation: { $in: conversationIds } }, { listing: ours }, { buyer: mine }, { seller: mine }] }],
        ["deals", Deal, { _id: { $in: dealIds } }],
        ["reviews", Review, { _id: { $in: reviews.map((review) => review._id) } }],
        ["reports", Report, { _id: { $in: reports.map((report) => report._id) } }],
        ["saves", Save, { $or: [{ user: mine }, { listing: ours }] }],
        ["views", ListingView, { $or: [{ viewer: mine }, { listing: ours }] }],
        ["notifications", Notification, { $or: [{ user: mine }, { actor: mine }, { link: { $in: links } }] }],
        ["blocks", Block, { $or: [{ blocker: mine }, { blocked: mine }] }],
        ["codes", Otp, { email: { $in: users.map((user) => user.email) } }]
    ];
    const results = await Promise.all(deletions.map(([, Model, filter]) => Model.deleteMany(filter)));
    // The accounts go last: if anything above failed, running --reset again finds them and finishes the job.
    const { deletedCount: accounts } = await User.deleteMany({ _id: mine });

    // Photos uploaded while someone was logged in as a demo account (the seeded "static:" ones are skipped).
    await deleteImages([...listings.flatMap((listing) => listing.images), ...messages.filter((m) => m.image?.publicId).map((m) => m.image)]);

    // Other people's trust scores that counted something deleted here: a deal they finished with a demo
    // account or cancelled, a review they got, an upheld report a demo account filed about them.
    const counted = [
        ...deals.filter((deal) => deal.status === DEAL_STATUS.COMPLETED).flatMap((deal) => [deal.buyer, deal.seller]),
        ...deals.filter((deal) => deal.status === DEAL_STATUS.CANCELLED).map((deal) => deal.cancelledBy),
        ...reviews.map((review) => review.reviewee),
        ...reports.filter((report) => report.status === REPORT_STATUS.RESOLVED && UPHELD_REPORT_ACTIONS.includes(report.action)).map((report) => report.user)
    ];
    const others = new Set(counted.filter((id) => id && !isDemoUser(id)).map(String));
    await Promise.all([...others].map((id) => recomputeTrust(id)));

    const counts = deletions.map(([name], i) => `${results[i].deletedCount} ${name}`);
    console.log(`🧹 Removed ${accounts} demo accounts with ${counts.join(", ")}.`);
};

// ── People and listings ───────────────────────────────────

const createUser = async (campus, { email, name, hostel, bio, joined, seen }, extra) => {
    const place = hostel ? campus.hostels.find((h) => h.name === hostel) : null;
    if (hostel && !place) throw new Error(`${hostel} isn't a hostel of the demo campus (seed/campuses.data.js)`);

    return User.create({
        name,
        email,
        bio,
        campus: campus._id,
        hostel: place?.name ?? "",
        location: toPoint(place?.location ?? campus.location),
        isVerified: true,
        isDemo: true,
        createdAt: daysAgo(joined),
        lastSeenAt: hoursAgo(seen),
        ...extra
    });
};

// Nobody logs in as the other students, so their passwords are random and never shown.
const randomPassword = () => crypto.randomBytes(18).toString("base64url");

const createListing = async (seller, { image, posted, views, ...form }) => {
    // The same rules as the sell form: title length, a price where one is needed, kit items, …
    const { keepImages, imageOrder, ...data } = listingSchema.parse(form);
    const createdAt = daysAgo(posted);

    return Listing.create({
        ...data,
        images: [{ url: `/demo/${image}.svg`, publicId: `static:demo/${image}` }],
        seller: seller._id,
        campus: seller.campus,
        hostel: seller.hostel,
        location: toPoint(seller.location),
        views,
        createdAt,
        expiresAt: new Date(createdAt.getTime() + LISTING_LIFETIME_DAYS * DAY_MS)
    });
};

// ── Chats ─────────────────────────────────────────────────
// Each step does what the API's own handler does (named in the comments), through the same helpers,
// but at the moment it happened in the story instead of now.

// notify() as the API calls it, then dated to when it happened. Anything older than a day was seen.
const notifyAt = async (at, userId, content) => {
    const notification = await notify(userId, content);
    if (!notification) return;
    await Notification.updateOne(
        { _id: notification._id },
        { $set: { createdAt: at, updatedAt: at, read: Date.now() - at > DAY_MS } },
        { timestamps: false, overwriteImmutable: true }
    );
};

// startConversation: the visitor messages the owner; who buys and who sells is fixed from the listing type.
const startChat = async (listing, visitor, at) => {
    await claimListingTerms(listing, () => new Error(`“${listing.title}” isn't available for a chat`));
    const conversation = await Conversation.create({
        listing: listing._id,
        owner: listing.seller,
        visitor: visitor._id,
        ...dealRoles(listing.type, listing.seller, visitor._id),
        participants: [listing.seller, visitor._id],
        listingSnapshot: { title: listing.title, cover: coverOf(listing), type: listing.type },
        lastMessageAt: at,
        createdAt: at
    });
    return conversation.toObject();
};

// markRead: `user` has seen everything posted so far (the steps run in time order).
const readChat = (conversation, user, at) => {
    const role = chatRoleOf(conversation, user._id);
    return Conversation.updateOne(
        { _id: conversation._id },
        [{ $set: { [`lastReadAt.${role}`]: { $max: [`$lastReadAt.${role}`, at] }, [`unread.${role}`]: 0 } }],
        { updatePipeline: true }
    );
};

// postMessage (utils/chat.js) keeps the inbox preview and unread counters; createdAt dates the message.
// Whoever acts has read the chat first, as they would have on screen.
const post = async (conversation, actor, at, fields, options = {}) => {
    await readChat(conversation, actor, at);
    return postMessage(conversation, { ...fields, createdAt: at }, { actorId: actor._id, ...options });
};

const systemEvent = (event, data) => ({ type: "system", system: { event, data } });

// sendMessage.
const say = (conversation, from, at, text) => post(conversation, from, at, { sender: from._id, type: "text", text });

// createOffer: the listing type decides the terms (offerTerms), the offer card goes into the chat.
const makeOffer = async (conversation, from, at, body) => {
    const listing = await Listing.findById(conversation.listing).lean();
    const terms = offerTerms(listing.type, offerSchema.parse(body));
    await claimListingTerms(listing, () => new Error(`“${listing.title}” can't take an offer`));

    const offer = await Offer.create({
        listing: listing._id,
        conversation: conversation._id,
        buyer: conversation.buyer,
        seller: conversation.seller,
        ...terms,
        awaiting: otherDealRole(dealRoleOf(conversation, from._id)),
        proposedBy: from._id,
        history: [{ by: from._id, action: "offered", ...terms, at }],
        expiresAt: offerExpiry(at),
        createdAt: at
    });
    await post(conversation, from, at, { sender: from._id, type: "offer", offer: offer._id }, { set: { activeOffer: offer._id } });
    await notifyAt(at, counterpartOf(conversation, from._id), {
        type: "offer_received",
        title: `New offer on “${listing.title}”`,
        body: listing.type === "free" ? `${firstName(from.name)} would like it` : `${firstName(from.name)} offered ${describeTerms(offer, listing)}`,
        link: chatLink(conversation._id),
        actor: from._id,
        image: coverOf(listing)
    });
    return offer.toObject();
};

// respondToOffer "counter": new terms, and it's the other person's turn (with a fresh 48 hours).
const counterOffer = async (conversation, offer, by, at, { amount }) => {
    const listing = await Listing.findById(offer.listing).lean();
    const terms = offerTerms(listing.type, { amount, periods: offer.periods, note: "" });
    const myRole = dealRoleOf(offer, by._id);

    const countered = await Offer.findOneAndUpdate(
        { _id: offer._id, status: OFFER_STATUS.PENDING, awaiting: myRole },
        {
            $set: { ...terms, awaiting: otherDealRole(myRole), proposedBy: by._id, expiresAt: offerExpiry(at), updatedAt: at },
            $push: { history: { by: by._id, action: "countered", ...terms, at } }
        },
        { returnDocument: "after", timestamps: false }
    ).lean();
    if (!countered) throw new Error(`The offer on “${listing.title}” isn't waiting for ${by.name}`);

    await post(conversation, by, at, systemEvent("offer_countered", { offerId: offer._id, ...terms }));
    await notifyAt(at, counterpartOf(offer, by._id), {
        type: "offer_countered",
        title: `Counter offer on “${listing.title}”`,
        body: `${firstName(by.name)} countered with ${describeTerms(countered, listing)}`,
        link: chatLink(conversation._id),
        actor: by._id,
        image: coverOf(listing)
    });
    return countered;
};

// respondToOffer "accept": claim the offer, reserve the listing for a deal id made up front (only that
// deal can release it), create the deal, point the chat at it and close every other offer on the listing.
const acceptOffer = async (conversation, offer, by, at) => {
    const dealId = new mongoose.Types.ObjectId();
    const accepted = await Offer.findOneAndUpdate(
        { _id: offer._id, status: OFFER_STATUS.PENDING, awaiting: dealRoleOf(offer, by._id) },
        {
            $set: { status: OFFER_STATUS.ACCEPTED, respondedAt: at, deal: dealId, updatedAt: at },
            $push: { history: { by: by._id, action: "accepted", amount: offer.amount, periods: offer.periods, at } }
        },
        { returnDocument: "after", timestamps: false }
    ).lean();
    if (!accepted) throw new Error(`Offer ${offer._id} isn't waiting for ${by.name}`);

    const listing = await reserveListing(accepted.listing, dealId);
    if (!listing) throw new Error(`Listing ${accepted.listing} isn't available to reserve for its deal`);

    const [buyer, seller] = await Promise.all([User.findById(accepted.buyer).lean(), User.findById(accepted.seller).lean()]);
    const deal = await Deal.create({
        _id: dealId,
        listing: listing._id,
        conversation: conversation._id,
        offer: accepted._id,
        buyer: buyer._id,
        seller: seller._id,
        campus: listing.campus,
        amount: accepted.amount * accepted.periods,
        periods: accepted.periods,
        listingType: listing.type,
        category: listing.category,
        title: listing.title,
        cover: coverOf(listing),
        sellerHostel: seller.hostel,
        buyerHostel: buyer.hostel,
        createdAt: at
    });

    await Conversation.updateOne({ _id: conversation._id }, { deal: dealId });
    await Conversation.updateOne({ _id: conversation._id, activeOffer: accepted._id }, { activeOffer: null });
    await post(conversation, by, at, systemEvent("offer_accepted", { offerId: accepted._id, dealId, amount: deal.amount, periods: deal.periods }));
    await closeListingNegotiations(listing._id, { reason: "reserved", keepOfferId: accepted._id, actorId: by._id });
    const what = listing.type === "free" ? "your request" : describeTerms(accepted, listing);
    await notifyAt(at, accepted.proposedBy, {
        type: "offer_accepted",
        title: "Offer accepted 🎉",
        body: `${firstName(by.name)} accepted ${what} for “${listing.title}”. Next, agree on a meetup.`,
        link: dealLink(dealId),
        actor: by._id,
        image: coverOf(listing)
    });
    return deal.toObject();
};

// proposeMeetup: one of the campus's safe spots, at a time ahead (the other person confirms it).
const proposeMeetup = async (conversation, deal, by, at, spotName, meetupAt) => {
    const campus = await Campus.findById(deal.campus).select("safeSpots").lean();
    const spot = campus.safeSpots.find((place) => place.name === spotName);
    if (!spot) throw new Error(`${spotName} isn't a safe spot of the demo campus`);
    if (meetupAt <= at) throw new Error("A meetup has to be planned ahead");

    await Deal.updateOne(
        { _id: deal._id, isOpen: true },
        { $set: { meetup: { spotId: spot._id, spotName: spot.name, at: meetupAt, proposedBy: by._id, confirmed: false }, status: DEAL_STATUS.AGREED, updatedAt: at } },
        { timestamps: false }
    );
    await post(conversation, by, at, systemEvent("deal_meetup_proposed", { dealId: deal._id, spotName: spot.name, at: meetupAt }));
    await notifyAt(at, counterpartOf(deal, by._id), {
        type: "deal_meetup_proposed",
        title: "Meetup proposed 📍",
        body: `${firstName(by.name)} suggested ${spot.name}, ${meetupTime(meetupAt)}, for “${deal.title}”.`,
        link: dealLink(deal._id),
        actor: by._id,
        image: deal.cover
    });
};

// confirmMeetup: only the person who didn't propose it, while that time is still ahead.
const confirmMeetup = async (conversation, deal, by, at) => {
    const confirmed = await Deal.findOneAndUpdate(
        { _id: deal._id, isOpen: true, status: DEAL_STATUS.AGREED, "meetup.proposedBy": { $ne: by._id }, "meetup.at": { $gt: at } },
        { $set: { "meetup.confirmed": true, status: DEAL_STATUS.SCHEDULED, updatedAt: at }, $min: { scheduledAt: at } },
        { returnDocument: "after", timestamps: false }
    ).lean();
    if (!confirmed) throw new Error(`The meetup for “${deal.title}” can't be confirmed`);

    const { meetup } = confirmed;
    await post(conversation, by, at, systemEvent("deal_meetup_confirmed", { dealId: deal._id, spotName: meetup.spotName, at: meetup.at }));
    await notifyAt(at, meetup.proposedBy, {
        type: "deal_meetup_confirmed",
        title: "Meetup confirmed ✅",
        body: `${firstName(by.name)} confirmed ${meetup.spotName}, ${meetupTime(meetup.at)}, for “${deal.title}”.`,
        link: dealLink(deal._id),
        actor: by._id,
        image: deal.cover
    });
};

// completeDeal: the buyer entered the seller's code (or scanned the QR) a couple of minutes after the
// seller opened it. The listing this deal reserved is sold; a rental is rented out until its last period ends.
const completeDeal = async (conversation, deal, buyer, at, method) => {
    const handoverExpiresAt = new Date(at.getTime() - 2 * MINUTE_MS + HANDOVER_TTL_MINUTES * MINUTE_MS);
    await Deal.updateOne(
        { _id: deal._id, buyer: buyer._id, isOpen: true },
        {
            $set: {
                status: DEAL_STATUS.COMPLETED,
                isOpen: false,
                completedAt: at,
                handover: { expiresAt: handoverExpiresAt, attempts: 0, method, completedAt: at },
                updatedAt: at
            }
        },
        { timestamps: false }
    );

    const { rentPeriod } = await Listing.findById(deal.listing).select("rentPeriod").lean();
    const sold = await Listing.findOneAndUpdate(
        { _id: deal.listing, reservedFor: deal._id },
        {
            $set: {
                status: LISTING_STATUS.SOLD,
                soldAt: at,
                ...(deal.listingType === "rent" && { rentedUntil: new Date(at.getTime() + deal.periods * RENT_PERIOD_DAYS[rentPeriod] * DAY_MS) })
            },
            $unset: { reservedFor: 1 }
        },
        { returnDocument: "after" }
    );
    if (!sold) throw new Error(`“${deal.title}” wasn't reserved for its deal`);

    await post(conversation, buyer, at, systemEvent("deal_completed", { dealId: deal._id, method }));
    const link = dealLink(deal._id);
    await notifyAt(at, deal.seller, {
        type: "deal_completed",
        title: "Deal completed 🎉",
        body: `${firstName(buyer.name)} confirmed the handover of “${deal.title}”. Leave them a review!`,
        link,
        actor: buyer._id,
        image: deal.cover
    });
    await notifyAt(at, buyer._id, {
        type: "deal_completed",
        title: "Deal completed 🎉",
        body: `The handover of “${deal.title}” is done. How did it go? Leave a review.`,
        link,
        actor: deal.seller,
        image: deal.cover
    });
};

// reviewDeal: once per side of a completed deal.
const review = async (deal, by, at, body) => {
    const { rating, comment } = reviewSchema.parse(body);
    const role = dealRoleOf(deal, by._id);
    const revieweeId = counterpartOf(deal, by._id);

    await Deal.updateOne(
        { _id: deal._id, status: DEAL_STATUS.COMPLETED },
        { $set: { [role === "buyer" ? "reviewedByBuyer" : "reviewedBySeller"]: true, updatedAt: at } },
        { timestamps: false }
    );
    await Review.create({ deal: deal._id, listing: deal.listing, reviewer: by._id, reviewee: revieweeId, role, rating, comment, createdAt: at });
    await notifyAt(at, revieweeId, {
        type: "review_received",
        title: `${firstName(by.name)} left you a review`,
        body: `${"★".repeat(rating)}${"☆".repeat(5 - rating)} for “${deal.title}”${comment ? `: “${comment}”` : ""}`,
        link: dealLink(deal._id),
        actor: by._id,
        image: deal.cover
    });
};

// createReport on a listing. One report doesn't hide anything: it waits in the admin's queue.
const reportListing = async (reporter, listing, at, { reason, details }) => {
    const report = reportSchema.parse({ targetType: "listing", targetId: String(listing._id), reason, details });
    await Report.create({
        reporter: reporter._id,
        targetType: report.targetType,
        listing: listing._id,
        user: listing.seller,
        campus: reporter.campus,
        reason: report.reason,
        details: report.details,
        countsTowardFlag: countsTowardFlag(reporter, at),
        createdAt: at
    });
    await User.updateOne({ _id: reporter._id }, { $inc: { "reportStats.filed": 1 } });
};

// ── The stories ───────────────────────────────────────────

const playStories = async (p, l) => {
    // Two weeks ago Rohan bought Diya's calculator: met at the food court, reviewed both ways.
    const calc = await startChat(l.calculator, p.rohan, on(-14, "18:05"));
    await say(calc, p.rohan, on(-14, "18:05"), "Hi Diya! Is the fx-991ES still available? I need it for the M2 exam next week.");
    await say(calc, p.seller, on(-14, "18:20"), "Yes, it is! Works perfectly and comes with the hard cover.");
    const calcOffer = await makeOffer(calc, p.rohan, on(-14, "18:24"), { amount: 550, note: "Would you take ₹550? I can collect it tomorrow." });
    const calcDeal = await acceptOffer(calc, calcOffer, p.seller, on(-14, "18:40"));
    await proposeMeetup(calc, calcDeal, p.rohan, on(-14, "18:42"), "Food Court", on(-13, "13:30"));
    await confirmMeetup(calc, calcDeal, p.seller, on(-14, "18:50"));
    await completeDeal(calc, calcDeal, p.rohan, on(-13, "13:36"), "code");
    await say(calc, p.rohan, on(-13, "13:40"), "Got it, thanks a lot! 🙌");
    await review(calcDeal, p.rohan, on(-13, "14:00"), { rating: 5, comment: "Calculator works like new and Diya was right on time. Smooth deal!" });
    await review(calcDeal, p.seller, on(-13, "20:15"), { rating: 5, comment: "Quick to reply and easy to meet. Good luck for M2!" });
    await readChat(calc, p.seller, on(-13, "20:15"));

    // Last week Aarav (buyer@) rented Ananya's guitar for a week: handed over with the QR code.
    const guitar = await startChat(l.guitar, p.buyer, on(-4, "20:10"));
    await say(guitar, p.buyer, on(-4, "20:10"), "Hey Ananya! Could I rent the guitar for a week? We have a music night in the hostel on Friday 🎸");
    await say(guitar, p.ananya, on(-4, "20:25"), "Sure! It comes with a gig bag and a capo.");
    const guitarOffer = await makeOffer(guitar, p.buyer, on(-4, "20:27"), { amount: 150, periods: 1, note: "One week works for me." });
    const guitarDeal = await acceptOffer(guitar, guitarOffer, p.ananya, on(-4, "21:02"));
    await proposeMeetup(guitar, guitarDeal, p.ananya, on(-4, "21:05"), "Main Gate", on(-3, "18:00"));
    await confirmMeetup(guitar, guitarDeal, p.buyer, on(-4, "21:30"));
    await completeDeal(guitar, guitarDeal, p.buyer, on(-3, "18:07"), "qr");
    await review(guitarDeal, p.ananya, on(-3, "21:00"), { rating: 5, comment: "Picked it up right on time and was super careful with it. Happy to rent to Aarav again!" });
    await review(guitarDeal, p.buyer, on(-2, "09:30"), { rating: 4, comment: "Lovely guitar, and the capo was a nice extra. The low E buzzes a little, but it plays great." });
    await readChat(guitar, p.ananya, on(-2, "09:30"));

    // The open deal, between the two demo logins: Diya (seller@) countered Aarav's offer on her
    // headphones and he accepted. They meet at the library tomorrow; she starts the handover there.
    const phones = await startChat(l.headphones, p.buyer, on(-3, "19:05"));
    await say(phones, p.buyer, on(-3, "19:05"), "Hi Diya! Are the headphones still available? How's the battery backup?");
    await say(phones, p.seller, on(-3, "19:20"), "Hey! Yes 🙂 The battery easily lasts two days for me, and the ear cushions are new.");
    const phonesOffer = await makeOffer(phones, p.buyer, on(-3, "19:24"), { amount: 750, note: "Can you do ₹750? I can pick them up near Beta Hostel." });
    const countered = await counterOffer(phones, phonesOffer, p.seller, on(-3, "20:02"), { amount: 800 });
    const phonesDeal = await acceptOffer(phones, countered, p.buyer, on(-3, "20:10"));
    await proposeMeetup(phones, phonesDeal, p.seller, on(-2, "10:15"), "Library", on(1, "17:30"));
    await confirmMeetup(phones, phonesDeal, p.buyer, on(-2, "10:40"));
    await say(phones, p.buyer, on(-2, "10:42"), "Confirmed! See you at the library 👍");

    // The offer waiting for Diya: Vikram wants her cycle (she can accept, counter or decline it).
    const cycle = await startChat(l.cycle, p.vikram, hoursAgo(6));
    await say(cycle, p.vikram, hoursAgo(6), "Hi! Is the cycle still available? Do the gears shift smoothly?");
    await say(cycle, p.seller, hoursAgo(5.6), "Yes! The gears and brakes were serviced last month, and the tyres are new.");
    await makeOffer(cycle, p.vikram, hoursAgo(5), { amount: 2800, note: "Can I pick it up on Saturday morning?" });

    // Two chats for Aarav: Ishita has the drafter he wants (unread), Priya proposes a book swap.
    const drafter = await startChat(l.drafter, p.ishita, on(-1, "21:15"));
    await say(drafter, p.ishita, on(-1, "21:15"), "Hi Aarav! I have an Omega mini drafter from first year, barely used. Would ₹250 work?");

    const books = await startChat(l.osBook, p.priya, on(-2, "16:30"));
    await say(books, p.priya, on(-2, "16:30"), "Hey Aarav, I have Korth's DBMS book (6th edition). Want to swap it for your Galvin?");
    await say(books, p.buyer, on(-2, "17:05"), "That's exactly the one I need! Let me check the edition tonight and get back to you.");
    await readChat(books, p.priya, on(-2, "17:20"));

    // For the admin's queue.
    await reportListing(p.ishita, l.iron, on(-1, "11:20"), {
        reason: "scam",
        details: "Wants the full amount on UPI before you even see the iron. Feels like a scam."
    });
};

// ── Main ──────────────────────────────────────────────────

let options;
try {
    ({ values: options } = parseArgs({ options: { reset: { type: "boolean", default: false }, "admin-password": { type: "string" } } }));
} catch (err) {
    console.error(`❌ ${err.message}\n   ${USAGE}`);
    process.exit(1);
}

const adminPasswordArg = options["admin-password"];
if (adminPasswordArg !== undefined) {
    const check = passwordField.safeParse(adminPasswordArg);
    if (!check.success) {
        console.error(`❌ --admin-password: ${check.error.issues[0].message}`);
        process.exit(1);
    }
}

await connectDB();

const campus = await Campus.findOne({ slug: DEMO_CAMPUS_SLUG }).lean();
if (!campus) await stop("The demo campus doesn't exist yet. Run npm run seed first.");

if (options.reset) {
    await resetDemoData(campus);
} else if (await User.exists(demoUserFilter(campus))) {
    await stop("The demo data is already there. Run npm run seed:demo -- --reset to start it over.");
}

// A real account that happens to use one of the demo emails is never taken over.
const demoEmails = [...Object.values(peopleData), adminData].map((person) => person.email);
const taken = await User.find({ email: { $in: demoEmails } }).select("email").lean();
if (taken.length > 0) {
    await stop(`${taken.map((user) => user.email).join(", ")} already belong to accounts that aren't demo accounts. Remove them first.`);
}

// The demo admin's password is random unless one was given (in every environment: the database may be
// the production one).
const adminPassword = adminPasswordArg ?? randomPassword();

const seedDemoData = async () => {
    const people = Object.fromEntries(
        await Promise.all(
            Object.entries(peopleData).map(async ([key, person]) => {
                const password = key === "buyer" || key === "seller" ? DEMO_PASSWORD : randomPassword();
                return [key, await createUser(campus, person, { password })];
            })
        )
    );
    const admin = await createUser(campus, adminData, { password: adminPassword, role: ROLES.ADMIN, adminScope: ADMIN_SCOPE.CAMPUS });

    const listings = {};
    for (const [key, { seller, ...listing }] of Object.entries(listingData)) {
        listings[key] = await createListing(people[seller], listing);
    }

    for (const [who, what, days] of saveData) {
        await Save.create({ user: people[who]._id, listing: listings[what]._id, createdAt: daysAgo(days) });
        await Listing.updateOne({ _id: listings[what]._id }, { $inc: { saves: 1 } }, { timestamps: false });
    }

    await playStories(people, listings);

    const accounts = [...Object.values(people), admin];
    await Promise.all(accounts.map((user) => recomputeTrust(user._id)));
    return { people, admin, accounts };
};

// Whatever was created before a failure is demo data too, so --reset clears it.
const { people, admin, accounts } = await seedDemoData().catch((err) => {
    console.error(err);
    return stop("Seeding stopped halfway. Fix the problem above, then run npm run seed:demo -- --reset.");
});

// What's there now, counted from the database.
const ids = { $in: accounts.map((user) => user._id) };
const chatIds = await Conversation.find({ participants: ids }).distinct("_id");
const [listingCount, messageCount, offerCount, pendingCount, dealCount, openDealCount, reviewCount, saveCount, notificationCount, reportCount] =
    await Promise.all([
        Listing.countDocuments({ seller: ids }),
        Message.countDocuments({ conversation: { $in: chatIds } }),
        Offer.countDocuments({ conversation: { $in: chatIds } }),
        Offer.countDocuments({ conversation: { $in: chatIds }, status: OFFER_STATUS.PENDING }),
        Deal.countDocuments({ buyer: ids }),
        Deal.countDocuments({ buyer: ids, isOpen: true }),
        Review.countDocuments({ reviewer: ids }),
        Save.countDocuments({ user: ids }),
        Notification.countDocuments({ user: ids }),
        Report.countDocuments({ reporter: ids, status: REPORT_STATUS.OPEN })
    ]);

console.log(
    `\n✅ ${campus.name} is ready: ${accounts.length} demo accounts, ${listingCount} listings, ${chatIds.length} chats ` +
    `(${messageCount} messages), ${offerCount} offers (${pendingCount} waiting for a reply), ${dealCount} deals ` +
    `(${openDealCount} open), ${reviewCount} reviews, ${saveCount} saves, ${notificationCount} notifications, ` +
    `${reportCount} open report.`
);
console.log("\n   Demo logins:");
console.log(`   👤 ${people.buyer.email.padEnd(24)} ${DEMO_PASSWORD}   (${people.buyer.name}, buying)`);
console.log(`   👤 ${people.seller.email.padEnd(24)} ${DEMO_PASSWORD}   (${people.seller.name}, selling)`);
console.log(`   🛡️  ${admin.email.padEnd(24)} ${adminPassword}   (campus admin${adminPasswordArg ? "" : ": a random password, shown only now"})\n`);

await mongoose.disconnect();
