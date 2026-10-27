import { baseApi } from "./baseApi";

// What a block (or unblock) changes for me: the chats with that person (closed or open again, offers
// cancelled), their profile, and every list that hides a blocked pair's listings.
const blockTags = (userId) => ["Blocks", { type: "Profile", id: userId }, "Conversations", "Messages", "Feed", "Listing", "Saved"];

export const trustApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // "Show more" under a profile's reviews. The profile brings the newest 5 itself, so the first page
    // starts before the last of those (`before`); later pages go further back in time.
    getUserReviews: build.infiniteQuery({
      infiniteQueryOptions: {
        initialPageParam: null,
        getNextPageParam: (lastPage) => (lastPage.hasMore && lastPage.reviews.length > 0 ? lastPage.reviews.at(-1).createdAt : undefined),
      },
      query: ({ queryArg: { userId, before }, pageParam }) => ({
        url: `/users/${userId}/reviews`,
        params: { before: pageParam ?? before, limit: 10 },
      }),
      providesTags: (result, error, { userId }) => [{ type: "Reviews", id: userId }],
    }),

    // { targetType: "listing" | "user" | "message", targetId, reason, details? }. Nobody is ever told
    // who reported them; the answer is the same whatever happens next.
    createReport: build.mutation({
      query: (body) => ({ url: "/reports", method: "POST", data: body }),
    }),

    // The people I blocked (Settings), newest first.
    getBlocks: build.query({
      query: () => ({ url: "/users/me/blocks", params: { limit: 200 } }),
      providesTags: ["Blocks"],
    }),

    // Both are idempotent: blocking twice, or unblocking someone who isn't blocked, changes nothing.
    blockUser: build.mutation({
      query: (userId) => ({ url: `/users/${userId}/block`, method: "POST" }),
      invalidatesTags: (result, error, userId) => (error ? [] : blockTags(userId)),
    }),

    unblockUser: build.mutation({
      query: (userId) => ({ url: `/users/${userId}/block`, method: "DELETE" }),
      invalidatesTags: (result, error, userId) => (error ? [] : blockTags(userId)),
    }),
  }),
});

export const {
  useGetUserReviewsInfiniteQuery,
  useCreateReportMutation,
  useGetBlocksQuery,
  useBlockUserMutation,
  useUnblockUserMutation,
} = trustApi;
