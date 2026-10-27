import { baseApi } from "./baseApi";
import { setChatDealStatus } from "./chat.api";
import { dealNews } from "../utils/deals";

const DEAL_LIST = { type: "Deals", id: "LIST" };
const DEALS_BADGE = { type: "Deals", id: "UNREAD" };

// Refusals that mean this tab's copy of the deal is out of date: it closed, the meetup changed, the
// listing went under review (403/404/409), or the seller's code ran out, was never shown, or has just
// used up its last try (nothing else announces that one).
const STALE_CODES = ["CODE_EXPIRED", "NO_HANDOVER", "TOO_MANY_ATTEMPTS"];
const isStale = (error) =>
  [403, 404, 409].includes(error?.status) ||
  STALE_CODES.includes(error?.data?.code) ||
  (error?.data?.code === "WRONG_CODE" && error.data.attemptsLeft === 0);

const toTime = (date) => new Date(date ?? 0).getTime();

// A sold or released listing changes everywhere it shows, and trust scores and deal counts move.
const listingChanged = (deal) => [{ type: "Listing", id: deal.listing?._id }, "MyListings", "Feed", "Saved", "Profile"];

// Deals with one of my own actions on its way. The server sends deal:update before it answers me, so
// an update that arrives meanwhile is my own doing, not news from the other person.
const pendingActions = new Map(); // dealId → how many requests are running
const trackAction = (dealId, change) => {
  const count = (pendingActions.get(dealId) ?? 0) + change;
  if (count > 0) pendingActions.set(dealId, count);
  else pendingActions.delete(dealId);
};

export const dealsApi = baseApi.injectEndpoints({
  endpoints: (build) => {
    // Every deal action answers with the whole deal as I now see it, which replaces the cached copies.
    // `alsoChanges(deal)` names other caches the action affected (the listing, profiles).
    const dealAction = (path, alsoChanges) =>
      build.mutation({
        query: ({ dealId, ...body }) => ({ url: `/deals/${dealId}${path}`, method: "POST", data: body }),
        async onQueryStarted({ dealId }, { dispatch, queryFulfilled }) {
          trackAction(dealId, 1);
          try {
            const { data } = await queryFulfilled;
            dispatch(applyDealDetail(data.deal));
            dispatch(baseApi.util.invalidateTags([DEAL_LIST, DEALS_BADGE, ...(alsoChanges?.(data.deal) ?? [])]));
          } catch (err) {
            // The caller shows the error. A stale copy is reloaded, so the page shows what changed.
            if (isStale(err.error)) dispatch(baseApi.util.invalidateTags([{ type: "Deals", id: dealId }, DEAL_LIST]));
          } finally {
            trackAction(dealId, -1);
          }
        },
      });

    return {
      // ?status=active|completed|cancelled, most recently changed first. Pages are cursors on updatedAt.
      // Any change moves a deal to the front, so a refetch only needs the newest page.
      getDeals: build.infiniteQuery({
        infiniteQueryOptions: {
          initialPageParam: null,
          getNextPageParam: (lastPage) => (lastPage.hasMore && lastPage.deals.length > 0 ? lastPage.deals.at(-1).updatedAt : undefined),
          refetchCachedPages: false,
        },
        query: ({ queryArg: status, pageParam }) => ({ url: "/deals", params: { status, before: pageParam ?? undefined, limit: 20 } }),
        providesTags: [DEAL_LIST],
      }),

      getDeal: build.query({
        query: (id) => ({ url: `/deals/${id}` }),
        providesTags: (result, error, id) => [{ type: "Deals", id }],
      }),

      // { dealId, spotId, at } — either side; a new proposal replaces the old one ("Change").
      proposeMeetup: dealAction("/meetup"),
      // { dealId } — only the person who didn't propose it.
      confirmMeetup: dealAction("/meetup/confirm"),
      // { dealId } — the seller. Answers { qr, code, expiresAt, deal }: the code exists only in this
      // answer, so the card keeps it in its own state and it's never cached anywhere else.
      startHandover: dealAction("/handover"),
      // { dealId, token } (scanned QR) or { dealId, code } (typed) — the buyer.
      completeDeal: dealAction("/complete", listingChanged),
      // { dealId, reason, note? } — either side, while the deal is open.
      cancelDeal: dealAction("/cancel", listingChanged),
      // { dealId, rating, comment? } — once each, after the handover.
      reviewDeal: dealAction("/review", (deal) => [
        { type: "Profile", id: deal.otherUser?._id },
        { type: "Reviews", id: deal.otherUser?._id },
      ]),
    };
  },
});

export const {
  useGetDealsInfiniteQuery,
  useGetDealQuery,
  useProposeMeetupMutation,
  useConfirmMeetupMutation,
  useStartHandoverMutation,
  useCompleteDealMutation,
  useCancelDealMutation,
  useReviewDealMutation,
} = dealsApi;

// ── Cache updates ─────────────────────────────────────────
// Shared by deal:update (socket/SocketManager.jsx) and the answers to my own deal actions. A copy is
// never replaced by an older one: the two can arrive in either order.

const { selectCachedArgsForQuery, updateQueryData, invalidateTags } = dealsApi.util;

// The newest copy of a deal this tab has: its page, else its card in one of the lists.
const selectCachedDeal = (state, dealId) => {
  const detail = dealsApi.endpoints.getDeal.select(dealId)(state).data?.deal;
  if (detail) return detail;
  for (const status of selectCachedArgsForQuery(state, "getDeals")) {
    const pages = dealsApi.endpoints.getDeals.select(status)(state).data?.pages ?? [];
    const card = pages.flatMap((page) => page.deals).find((deal) => deal._id === dealId);
    if (card) return card;
  }
  return null;
};

// Every cached list that shows the deal, and the chats it came from. The lists are reloaded too
// (`DEAL_LIST`), because a new status can move a deal to another tab.
const patchDealEverywhere = (deal) => (dispatch, getState) => {
  for (const status of selectCachedArgsForQuery(getState(), "getDeals")) {
    dispatch(
      updateQueryData("getDeals", status, (draft) => {
        for (const page of draft.pages) {
          const card = page.deals.find((item) => item._id === deal._id);
          if (card) Object.assign(card, deal);
        }
      }),
    );
  }
  dispatch(setChatDealStatus(deal._id, deal.status));
  dispatch(invalidateTags([DEAL_LIST]));
};

// The answer to one of my deal actions: the deal page's full view of it.
const applyDealDetail = (detail) => (dispatch, getState) => {
  const state = getState();
  const current = selectCachedDeal(state, detail._id);
  if (current && toTime(detail.updatedAt) < toTime(current.updatedAt)) return; // a newer change is already here

  if (selectCachedArgsForQuery(state, "getDeal").includes(detail._id)) {
    dispatch(
      updateQueryData("getDeal", detail._id, (draft) => {
        draft.deal = detail;
      }),
    );
  }
  dispatch(patchDealEverywhere(detail));
};

// deal:update { dealId, deal }: my card of the deal after any change, by either of us (or a moderator
// hiding the listing). The card lacks what only the deal page shows (who cancelled and why, the
// reviews), so an open deal page also reloads when the other person changed the deal (my own
// actions bring the whole deal back in their answer).
// Returns what the other person just did ({ title, description }) for a toast, or null.
export const applyDealChange = ({ dealId, deal }) => (dispatch, getState) => {
  const state = getState();
  const mine = pendingActions.has(dealId);
  const previous = selectCachedDeal(state, dealId);
  if (previous && toTime(deal.updatedAt) < toTime(previous.updatedAt)) return null; // older than what's here

  if (selectCachedArgsForQuery(state, "getDeal").includes(dealId)) {
    dispatch(
      updateQueryData("getDeal", dealId, (draft) => {
        if (draft.deal) Object.assign(draft.deal, deal);
      }),
    );
    if (!mine && previous && toTime(deal.updatedAt) > toTime(previous.updatedAt)) dispatch(invalidateTags([{ type: "Deals", id: dealId }]));
  }
  dispatch(patchDealEverywhere(deal));

  return mine ? null : dealNews(previous, deal, state.auth.user?._id);
};
